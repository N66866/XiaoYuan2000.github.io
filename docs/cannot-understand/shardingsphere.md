# shardingsphere
## springboot 配置问题
在使用springboot + shardingsphere时，配置文件如下
```yaml
# application.yml
spring:
  datasource:
    # ShardingSphere 对 Driver 自定义，实现分库分表等隐藏逻辑
    driver-class-name: org.apache.shardingsphere.driver.ShardingSphereDriver
    # ShardingSphere 配置文件路径
    url: jdbc:shardingsphere:classpath:shardingsphere-config.yaml
```
然后启动项目，就会报错找不到文件（因为想使用外部文件，打的jar包里确实没有这个文件），但是根据众所周知的springboot配置文件加载顺序，会读取外部的`config`目录，然后`jar`包的同目录，再到`classpath`里的目录(简述，需要更详细的顺序可以百度一下)。  
我这个shardingsphere-config.yaml已经放在了config目录下，但是就是报错读取不到。困惑了一两个小时百度 Google找不到答案。
1. 尝试过将配置改为
```yaml
spring:
  datasource:
    # ShardingSphere 对 Driver 自定义，实现分库分表等隐藏逻辑
    driver-class-name: org.apache.shardingsphere.driver.ShardingSphereDriver
    # ShardingSphere 配置文件路径
    url: jdbc:shardingsphere:file:/usr/shortlink/admin/config/shardingsphere-config.yaml
```
2. 尝试过将配置改为
```yaml
spring:
  datasource:
    # ShardingSphere 对 Driver 自定义，实现分库分表等隐藏逻辑
    driver-class-name: org.apache.shardingsphere.driver.ShardingSphereDriver
    # ShardingSphere 配置文件路径
    url: jdbc:shardingsphere:classpath:config/shardingsphere-config.yaml
```

---
* 最终，还是去看shardingsphere官方文档，找到解决方案如下：  
[shardingsphere](http://s.xiaoyuan.space/17Fmc9)
```yaml
spring:
  datasource:
    # ShardingSphere 对 Driver 自定义，实现分库分表等隐藏逻辑
    driver-class-name: org.apache.shardingsphere.driver.ShardingSphereDriver
    # ShardingSphere 配置文件路径
    url: jdbc:shardingsphere:absolutepath:/usr/shortlink/admin/config/shardingsphere-config.yaml
```
将 classpath 改为 absolutepath即可