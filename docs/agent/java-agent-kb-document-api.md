# Java Agent：知识库文档与分块管理接口

知识库上线后，用户不仅要上传文档，还要管理文档和 chunk。比如删除文档、修改文档名称、启用/禁用文档、手动新增 chunk、编辑 chunk 内容、批量启用 chunk。这些接口看似 CRUD，但都牵涉 MySQL、对象存储、向量库的一致性。

## 文档管理接口概览

文档管理常见接口：

- `delete`：删除文档。
- `update`：更新文档信息。
- `enable`：启用或禁用文档。

共同点：

- 都要检查文档是否处于运行状态。
- 都要校验知识库归属。
- 都要考虑向量库数据。
- 都要控制事务边界。

如果文档正在分块、同步或刷新，不应该允许删除或修改关键配置。

## delete 文档

删除文档不只是删一行记录。

流程：

```text
校验文档归属
  -> 检查非 RUNNING 状态
  -> 删除或禁用 chunk
  -> 逻辑删除文档
  -> 删除向量库数据
  -> 删除对象存储文件
```

建议数据库里做逻辑删除，方便审计和恢复。

向量库删除可以按 `document_id` 批量删除。

对象存储删除失败时，不要回滚整个数据库事务，可以记录清理任务。因为对象存储不参与 MySQL 事务。

## update 文档

可更新内容通常包括：

- 文档名称。
- 处理模式。
- 分块配置。
- 定时同步配置。
- 是否启用调度。

注意：修改分块配置不建议自动触发重新分块。

原因：

- 重新分块是重任务。
- 用户可能只是先保存配置。
- 自动触发会让 update 接口边界变重。

更好的做法是：更新配置后提示用户手动触发重新分块。

## enable 文档

文档启用/禁用会影响检索。

禁用文档：

- MySQL 文档状态标记为禁用。
- chunk 标记为禁用。
- 向量库删除或过滤该文档向量。

启用文档：

- 校验文档已有可用 chunk。
- 必要时重新写入向量库。
- 更新文档和 chunk enabled 状态。

为什么启用时可能要计算 embedding？

因为禁用时如果把向量删了，启用时要把 chunk 重新同步到向量库。

## 编程式事务

涉及向量库时，单纯 `@Transactional` 不够。

可以用 `TransactionOperations` 明确控制 DB 事务，再在事务前后处理向量库：

```text
事务前：准备 embedding 或校验数据
事务中：更新 DB 状态
事务后：同步向量库或记录补偿
```

对耗时操作，比如 embedding 计算，不建议放在数据库事务里。

## Chunk 管理接口概览

常见 Chunk 接口：

- `pageQuery`
- `create`
- `update`
- `delete`
- `enable`
- `batchEnable`

Chunk 管理主要用于人工修正知识库内容。

比如分块结果不理想，管理员可以手动新增一个 FAQ chunk，或者禁用某个噪声 chunk。

## pageQuery

查询 chunk 列表时建议：

- 按 `chunk_index` 排序。
- 支持 `enabled` 过滤。
- 支持关键字搜索。
- 返回 token 估算、hash、更新时间。

`enabled` 过滤很有用：管理员可以只看当前参与检索的 chunk，也可以查看被禁用的 chunk。

## create Chunk

新增 chunk 前要校验：

- 文档是否存在。
- 文档是否启用。
- 文档是否不在运行状态。
- chunk 内容是否为空。
- chunkIndex 是否冲突。

为什么要求文档启用？

因为新增 chunk 通常是为了立即参与检索。如果文档都禁用了，新增 chunk 容易造成语义混乱。

新增流程：

```text
校验文档
  -> 生成 chunkIndex
  -> 计算 contentHash
  -> 估算 tokenCount
  -> 调 Embedding
  -> 写 chunk 表
  -> 写向量库
```

## update Chunk

更新 chunk 内容时，先做幂等判断：

```text
新 contentHash == 旧 contentHash
  -> 直接返回，不重新向量化
```

内容变化后，向量也必须变化。

常见做法是：

```text
更新 MySQL chunk
  -> 删除旧向量
  -> 插入新向量
```

向量库通常不适合“原地更新”，删旧插新更直观。

## delete Chunk

删除 chunk 时要处理：

- chunk 表逻辑删除或物理删除。
- 文档 chunk_count 递减。
- 向量库删除。

`chunk_count` 更新要防止负数：

```sql
chunk_count = CASE
  WHEN chunk_count > 0 THEN chunk_count - 1
  ELSE 0
END
```

## enable Chunk

启用 chunk 前要校验父文档是否启用。

如果父文档禁用，单独启用 chunk 没意义，也可能绕过文档级权限。

启用 chunk：

- DB 标记 enabled。
- 如果向量库没有该 chunk，写入向量。

禁用 chunk：

- DB 标记 disabled。
- 向量库删除该 chunk。

## batchEnable

批量启用/禁用要限制数量，比如最多 500 条。

原因：

- 避免一次请求拖垮 embedding 或向量库。
- 避免数据库事务过大。
- 便于失败重试。

批量启用时可以精准写入需要启用的 chunk 向量。

批量禁用时可以精准删除这些 chunk 的向量。

不要为了批量操作就全量重建整个文档向量，成本太高。

## 一致性策略

这些接口都要守住一个原则：

```text
MySQL 管理状态
向量库服务检索
两边不一致时必须可发现、可补偿
```

建议记录向量同步失败日志，定时补偿：

- chunk 已启用但向量缺失：补写。
- chunk 已禁用但向量仍存在：删除。
- chunk 内容 hash 和向量 metadata 不一致：重建。

## 管理接口设计重点

- RUNNING 状态禁止修改。
- 所有接口都校验知识库、文档、chunk 归属。
- 写操作尽量短事务。
- Embedding 这类耗时操作不要放 DB 事务里。
- 向量库失败要记录补偿。
- 批量操作要限制数量。
- 手工修改 chunk 后要同步向量。
