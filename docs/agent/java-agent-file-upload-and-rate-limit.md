# Java Agent：文件上传、内存与分布式限流

知识库系统的入口通常是文件上传。看起来只是一个 `MultipartFile` 接口，但一旦文件变大、并发变高、服务分布式部署，就会牵出上传限制、临时文件、对象存储 SDK、内存占用和限流位置选择等问题。

## 文件上传大小限制

很多人以为文件上传是“先把整个文件读到内存，再判断大小”。如果真是这样，一个 2GB 文件就能轻易打爆服务内存。

实际流程更早：

- 客户端上传时通常会带 `Content-Length`。
- Tomcat / Servlet 容器可以在解析 multipart 时判断大小。
- Spring 的 `MultipartResolver` 会结合配置抛出异常。
- 超限文件不会完整进入业务 Controller。

Spring Boot 常见配置：

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 30MB
      max-request-size: 35MB
      file-size-threshold: 2MB
```

含义：

- `max-file-size`：单个文件大小。
- `max-request-size`：整个 multipart 请求大小。
- `file-size-threshold`：超过阈值后写入临时文件，而不是继续放内存。

## Controller 拿到的不是整个文件内容

`MultipartFile` 更像一个文件引用。文件内容可能在内存，也可能在磁盘临时文件里。

所以业务代码里要避免这种写法：

```java
byte[] bytes = file.getBytes();
```

这会把文件一次性读进内存。

更推荐：

```java
try (InputStream input = file.getInputStream()) {
    // 流式处理或写入临时文件
}
```

## 为什么 30MB 文件可能占 100MB 内存

如果上传 30MB 文件到对象存储时，内存占用远超文件大小，常见原因不是 Spring Multipart，而是对象存储 SDK 在上传前做了缓冲。

以 S3 兼容协议为例，普通 `putObject` 往往需要对请求体做签名。为了计算签名，SDK 可能需要读取或缓冲请求体。

这会导致：

- 文件本身占用一份。
- SDK 缓冲占用一份。
- HTTP 客户端缓冲占用一份。
- 签名、重试、内部 byte buffer 还有额外开销。

于是 30MB 文件看到 100MB 内存占用，并不奇怪。

## 预签名 URL 思路

如果对象存储支持预签名 URL，可以让后端先生成一个上传地址，再用普通 HTTP 流式上传。

简化流程：

```text
后端生成预签名 URL
  -> 服务端或客户端用 URL 上传文件
  -> 对象存储校验签名
  -> 上传完成后保存 objectKey
```

预签名 URL 的好处是：

- 上传时不需要 SDK 对请求体重新签名。
- 可以减少 SDK 内部缓冲。
- 更容易做流式上传。
- 客户端直传对象存储时还能减轻应用服务器压力。

但也要注意：

- URL 要设置过期时间。
- 限制上传方法和对象路径。
- 回调或完成确认要校验文件归属。
- 不要把任意写权限暴露给前端。

## 为什么不能只做 QPS 限流

文件上传是长耗时操作。

QPS 限流控制的是“每秒进入多少请求”，但上传风险主要来自“同时有多少大文件正在传”。

例如：

```text
每秒只允许 5 个上传请求
每个上传持续 60 秒
1 分钟后可能有 300 个上传连接同时占用带宽和磁盘
```

所以文件上传更需要并发数限流，而不是单纯 QPS。

## 本地信号量

单机可以用 Java `Semaphore` 控制并发上传数。

```java
Semaphore semaphore = new Semaphore(10);

if (!semaphore.tryAcquire()) {
    throw new TooManyRequestsException();
}

try {
    upload(file);
} finally {
    semaphore.release();
}
```

问题是：服务一旦多实例部署，每个实例都有自己的信号量，无法控制全局并发。

## 分布式信号量

分布式场景可以使用 Redis / Redisson。

普通 `RSemaphore` 能控制全局许可数量，但有一个风险：实例拿到许可后宕机，许可可能无法释放。

文件上传更适合 `RPermitExpirableSemaphore`：

- 获取许可时带过期时间。
- 服务宕机后许可自动过期。
- 避免并发额度被永久占用。

伪流程：

```text
tryAcquire(permitTimeout)
  -> 成功：执行上传
  -> 失败：返回“上传任务过多”
finally
  -> release(permitId)
```

过期时间要略大于允许上传的最长时间，比如最大文件 100MB，预估最长 5 分钟，可以设置 8 到 10 分钟。

## 限流放哪一层

### Service 层

优点：

- 实现简单。
- 能结合业务逻辑，比如按用户、知识库、租户限流。

缺点：

- 请求可能已经进入 Tomcat。
- multipart 可能已经被解析。
- 对入口资源保护不够早。

### Filter 层

优点：

- 比 Controller / Service 更早。
- 可以在 multipart 解析前拦截。
- 适合单体应用或没有网关的系统。

缺点：

- 仍然进入了应用实例。
- 对多服务统一治理不如网关。

### Gateway 层

优点：

- 最靠前。
- 可以保护后端应用和 Tomcat 线程。
- 适合微服务统一限流。

缺点：

- 需要网关具备流式转发能力。
- 业务维度细粒度控制可能要和后端配合。

## 推荐策略

单体应用：

```text
Filter 层做并发限流
Service 层做业务校验
```

微服务架构：

```text
Gateway 做入口限流
业务层做租户/用户/知识库维度限流
```

两者不是互斥关系。网关保护入口资源，业务层保护业务规则。

## 文件上传接口检查清单

- 是否配置了 `max-file-size` 和 `max-request-size`。
- 是否避免 `file.getBytes()`。
- 是否理解对象存储 SDK 的缓冲行为。
- 大文件是否考虑预签名 URL。
- 是否用并发数限流而不是只用 QPS。
- 多实例部署是否使用分布式信号量。
- 许可是否有过期时间。
- 限流是否尽量前置到 Filter 或 Gateway。
- 上传失败后是否清理临时文件和对象存储残留。
