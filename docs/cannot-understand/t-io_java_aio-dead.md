# t-io 框架与java8 AIO 假死问题排查
## 场景介绍
近期我司需要根据t-io框架开发一个在线客服聊天系统，刚好t-io作者有一个商业产品谭聊，于是就开始部署测试遇到了这个假死问题。
这个问题表现为：
1. http api端口假死，服务器本机curl + telnet 都连接不上，tcp连接正常建立，t-io应用不会去accept
2. IM socket + websocket端口正常使用
目前问题已暂时解决(没根治)，特此记录下来一个持续两天的排查流程，从应用、框架、网络、最终到操作系统...
本文作者是个菜鸟，各位看到的大佬发现了问题根源的请轻喷...  

## 环境介绍
1. debian 11 + openjdk 8u342
2. debian 12 + zulu open-jdk8u452
3. centos 7 + zulu open-jdk8u452
以上三种环境问题都存在

## 排查流程
### 1. JVM排查
**起初发现问题时，第一时间怀疑的是jvm出问题，例如死锁、堆栈溢出、OOM、GC异常等**  
在这里使用了阿里的线上诊断工具:arthas，使用方式：  
启动工具
```java
java -jar arthas-boot.jar
```
#### 1.1 死锁
arthas 查询阻塞线程
```java
thread -b
```
但是由于本次排查没遇到，所以也没有输出可以分析...

#### 1.2 OOM、GC
arthas 查看
```java
dashboard
```
可以查看到当前内存、线程、类加载信息等，看到内存占用无异常、gc次数耗时无异常
```java
memory
```
可以看到内存详细信息、GC分代信息等，本次排查无异常

#### 1.3 堆栈
使用java命令保存当前堆栈
```java
jps // 查出java应用pid
jstack java应用pid> jstack.txt 2>&1 
```
导出假死状态时堆栈信息 对比 正常状态的堆栈信息也没发现异常

至此，JVM方面没发现任何异常

### 2. t-io源码排查
**没排查出问题，不感兴趣的可以往下走了**  
#### 2.1 启动与监听流程
**应用启动**  
应用配置方面的就不放出来了，直接找到入口 ``` org.tio.http.server.HttpServerStarter#start() ``` 直接进入tioServer.start()  

![pic](/cannot-understand/t-io-2.1.1.png)   
```java
org.tio.server.TioServer#start
```  
  
![pic](/cannot-understand/t-io-2.1.2.png)   
可以看到，tioServer 启动时会去取配置里的线程池，在本应用中，监听http、socket、websocket的三个端口配置的线程池是同一个。

这个start方法就没什么好看的了，重点就这些，可以确定的是t-io使用了JAVA AIO。

#### 2.2 连接接受
上文提到：AIO绑定端口后，会调用一次连接接收器AcceptCompletionHandler，将它注册进AIO的channel中。
此时操作系统如果有该绑定端口的tcp连接就会去回调这个Handler。  
![pic](/cannot-understand/t-io-2.2.1.png)    
连接接收器 accept tcp连接  
![pic](/cannot-understand/t-io-2.2.2.png)    
![pic](/cannot-understand/t-io-2.2.3.png)    
连接数据读取  

**后面的就是根据业务代码去获取api对应的处理方法，像SpringMVC的 Dispatch 什么那个中央处理器一样。有兴趣的可以往下走，这对本次排查无用，按下不表**

#### 2.3 连接响应
![pic](/cannot-understand/t-io-2.2.4.png)    
![pic](/cannot-understand/t-io-2.2.5.png)    

**至此t-io http连接这一块主要流程源码已经看完，可以进入下一步排查**

### 3. 网络排查

查看指定端口tcp连接数量
```sh
netstat -an | grep :[port] | awk '{print $6}' | sort | uniq -c | sort -nr
# 可以看到当前监听端口的tcp连接状态
# 我边假死的时候可以看到好几十个CLOSE_WAIT的状态
# 因此我在想，是不是这个CLOSE_WAIT导致的假死？tcp连接被用完了？
```

查看指定端口是否在监听
```sh
ss -lnt | grep :[port]
# 这个命令可以看到本机监听的tcp端口
# LISTEN 0 50 
# 监听状态 50=backlog最大数量，上文提到t-io创建时是使用0，jdk默认使用50
# 我就想，是不是这个backlog的问题？导致连接不上？
```

查看指定端口是否有tcp连接
```sh
tcpdump -i any tcp port [port]
# 可以查看本机所有网卡上指定端口有没有tcp流量
# 排查发现一切正常，有正常握手挥手
```

**tcp有正常握手挥手，我觉得所以可以排除网络问题了**

### 4. t-io应用与操作系统排查  
在上文，我们看了t-io的连接源码，接下来可以用arthas去排查t-io的调用堆栈，看看问题是出在了接受、读取、处理、响应之中的哪一个步骤。  
**以下命令都是在arthas中进行调用**  

#### 检查连接接收器AcceptCompletionHandler有没有正常调用
```sh
watch org.tio.server.AcceptCompletionHandler completed "{params,throwExp}" -x 3 -n 1
# 监听 AcceptCompletionHandler的completed方法有没有被调用，打印 params：传入参数、throwExp：有没有抛出异常 、 -x：对象展开深度 -n：匹配n次后退出
```

#### 检查连接读取器ReadCompletionHandler有没有正常调用
```sh
watch org.tio.server.ReadCompletionHandler completed "{params,throwExp}" -x 3 -n 1
# 监听 ReadCompletionHandler的completed方法有没有被调用，打印 params：传入参数、throwExp：有没有抛出异常 、 -x：对象展开深度 -n：匹配n次后退出
```

#### 检查解码器DecodeRunnable有没有正常调用
```sh
watch org.tio.core.task.DecodeRunnable decode "{params,returnObject,throwExp}" -x 3 -n 1
# 监听 DecodeRunnable的decode方法有没有被调用，打印 params：传入参数、throwExp：有没有抛出异常 、 returnObject：返回值、 -x：对象展开深度 -n：匹配n次后退出
```

#### 检查handler有没有正常调用
```sh
watch org.tio.core.task.HandlerRunnable decode  "{params,returnObject,throwExp}" -x 3 -n 1
# 监听 HandlerRunnable的handler方法有没有被调用，打印 params：传入参数、throwExp：有没有抛出异常 、 returnObject：返回值、 -x：对象展开深度 -n：匹配n次后退出
```

#### 检查DefaultHttpRequestHandler有没有正常调用
```sh
watch org.tio.http.server.handler.DefaultHttpRequestHandler handler "{params,throwExp}" -x 3 -n 1
```

#### 检查t-io有没有正常响应
```sh
watch org.tio.core.Tio send "{params,throwExp}" -x 3 -n 1
```

#### 检查JDK AIO 回调tio写是否正常
```sh
watch org.tio.core.WriteCompletionHandler completed "{params,throwExp}" -x 3 -n 1
```

**一顿操作猛如虎！发现直接卡在了AcceptCompletionHandler的回调上，接下来继续排查是操作系统没回调，还是t-io出了轨**

#### 使用stace监控fd有没有epoll回调
```sh
strace -f -e trace=epoll_ctl,epoll_wait,read -p [PID] 2>&1 | tee stace.log
# 监控指定pid上的系统事件

#也可以先查出fd
lsof -nP -iTCP:6060 -sTCP:LISTEN
strace -f -e  trace=epoll_ctl,epoll_wait,read -p [PID] 2>&1 | grep 'fd编号' | tee stace.log
grep -E 'epoll_wait.*(fd=fd编号|u32=fd编号)' strace.log 
grep 'u32=fd编号' strace.log
#发现假死状态时根本没有epoll_wait 回调通知java
#而正常状态时有: epoll_wait epoll_ctl ... EPOLLIN|EPOLLONSHOT 触发，也就是有被操作系统回调与jvm有往操作系统注册事件
```


## 解决方案 
至此，猜测是操作系统或者JDK AIO的问题？就是：
1. 操作系统没回调
2. JDK AIO没注册
3. 可能1和2都没发生，但是丢失了事件  

遇到这个问题我这个小菜鸟也没什么好方法了，只能写个监听线程，每3-5秒测试一次http端口是否正常连接，
如果不能正常连接的话，就重置http的serverSocketChannel的监听状态，然后重新注册一次事件
```java
// 通过反射修改监听状态，否则重复注册事件会报错
// 强行设置 acceptPending 为 false（反射 hack）
Field acceptPending = serverSocketChannel.getClass().getDeclaredField("acceptPending");
acceptPending.setAccessible(true);
acceptPending.set(serverSocketChannel, false);

Field accepting = serverSocketChannel.getClass().getDeclaredField("accepting");
accepting.setAccessible(true);
accepting.set(serverSocketChannel, new AtomicBoolean(false));

// 重新注册 accept
serverSocketChannel.accept(attachment, handler);
```
  
至此问题解决