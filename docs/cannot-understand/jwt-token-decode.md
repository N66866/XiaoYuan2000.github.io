# jwt解析token失败问题
## 问题描述

  前置需求：本人接到了一个需求，是做一个WebSocket服务，用于生成token和解析token，由于要能解析token信息且可能不是本服务解析。所以本人就用了JWT来生成token。

  问题发生：服务写好后，生成token一切正常，可是解码时就报各种各样的错。  
```c#
System.ArgumentException: 'IDX12723: Unable to decode the payload '[PII of type 'System.String' is hidden. For more details, see https://aka.ms/IdentityModel/PII.]' as Base64Url encoded string.'
“IDX12723: Unable to decode the payload \u0027[PII of type \u0027System.String\u0027 is hidden. For more details, see https://aka.ms/IdentityModel/PII.]\u0027 as Base64Url encoded string.”
```  
反正就是各种解析不了token的错。
然后通过debug模式，发现解析的payload是乱码。换成自己的电脑就没问题。

  尝试解决：通过百度 Google各种搜索引擎搜索后，发现很多类似的问题，先是听从他们的建议：
  1. 降低JWT版本
  2. 更换JWT生成token的方法
  然后无法解决，再进行自己的尝试：
  1. 独立一个控制台应用用于生成token、解析token，发现：直接解析token正常，如果先复制再粘贴回去解析就错误。（当时觉得太难理解了）
  2. 基于第一点，我换成自己的电脑测试，发现生成token和解析token都没错。（排除代码问题）
  3. 直接重启开发电脑，还是无法解决。
  4. 找了web字符串对比工具，发现代码直接保存的token和复制的token一致。（大坑，在解决方案栏目解释）
  5. 我直接out穿头
   
## 解决方案

怀疑是web字符串对比工具的问题，所以我打算用肉眼查看！这一看问题就来了，代码直接保存的token在txt上，我再把这个token复制粘贴，您猜怎么着？token变了！
```txt
// 代码保存的token没办法搞进来了，都是错的token


// 复制过的token
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJobWhLZXkiOiJiNTQ8419uEC2UaRX7itXEQBGMDPvrmRgnZLc5N2EzNiIsInVOYW1lIjoi5rWL6K-V6LSm5Y-3ODgiLCJ1WmgiOiIwMjdEODdBNy02NDMyLTQ8419uEC2UaRX7itXEQBGMDPvrmRgnZLcuYmYiOjE3MjExODI0MTQ8419uEC2UaRX7itXEQBGMDPvrmRgnZLcxNzIxMTQ8419uEC2UaRX7itXEQBGMDPvrmRgnZLclIiwiYXVkIjoiQ2xpZW50LUFQUCJ9.3z6Ca2ZnsN6EQl_fLe8xuZHSh3QBZABDo5xYiQeRR7k


//问题所在
复制过的token会随机将token串中一串替换成TQ8419uEC2UaRX7itXEQBGMDPvrmRgnZLc，但是长度又变得不多
```
**我擦咧，至此发现是电脑剪切板问题！一复制进剪切板token就是错的，怪不得他喵的用web字符串对比不出来，对比的两个都是错误的token**

后面换成不经过剪贴板的解析就恢复正常。。。