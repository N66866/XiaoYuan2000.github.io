# xxl-job
## 下载安装
[xxl-job官网](https://www.xuxueli.com/xxl-job)  

进入官网github/gitee下载，使用ide打开运行，要部署服务器的话，打包部署即可。

## spring-xxl-job
### 依赖

版本选择自己安装的对应版本
```xml
        <dependency>
            <groupId>com.xuxueli</groupId>
            <artifactId>xxl-job-core</artifactId>
            <version>${xxl-job.version}</version>
        </dependency>
```


### 配置
使用SpringBoot来做例子
配置文件中加入一下配置：  

```yaml
xxl:
  job:
    admin:
    	#xxl-job admin的地址
      addresses: http://127.0.0.1:8071/xxl-job-admin
    executor:
      address:
      	#当前应用名称/执行器名称
      appname: lottery-job
      ip:
      	#当前执行器端口，不是SpringBoot tomcat端口
      port: 8073
      logpath: logs/xxl-job/jobhandler
      logretentiondays: 50
    accessToken: default_token
```

### 引用配置  

```java
@Configuration
@Slf4j
public class LotteryXxlJobConfig {
    @Value("${xxl.job.admin.addresses}")
    private String adminAddresses;

    @Value("${xxl.job.accessToken}")
    private String accessToken;

    @Value("${xxl.job.executor.appname}")
    private String appname;

    @Value("${xxl.job.executor.address}")
    private String address;

    @Value("${xxl.job.executor.ip}")
    private String ip;

    @Value("${xxl.job.executor.port}")
    private int port;

    @Value("${xxl.job.executor.logpath}")
    private String logPath;

    @Value("${xxl.job.executor.logretentiondays}")
    private int logRetentionDays;

    @Bean
    public XxlJobSpringExecutor xxlJobExecutor() {
        log.info(">>>>>>>>>>> xxl-job config init.");

        XxlJobSpringExecutor xxlJobSpringExecutor = new XxlJobSpringExecutor();
        xxlJobSpringExecutor.setAdminAddresses(adminAddresses);
        xxlJobSpringExecutor.setAppname(appname);
        xxlJobSpringExecutor.setAddress(address);
        xxlJobSpringExecutor.setIp(ip);
        xxlJobSpringExecutor.setPort(port);
        xxlJobSpringExecutor.setAccessToken(accessToken);
        xxlJobSpringExecutor.setLogPath(logPath);
        xxlJobSpringExecutor.setLogRetentionDays(logRetentionDays);

        return xxlJobSpringExecutor;
    }

    /**********************************************************************************************
     * 针对多网卡、容器内部署等情况，可借助 "spring-cloud-commons" 提供的 "InetUtils" 组件灵活定制注册IP；
     *
     *      1、引入依赖：
     *          <dependency>
     *             <groupId>org.springframework.cloud</groupId>
     *             <artifactId>spring-cloud-commons</artifactId>
     *             <version>${version}</version>
     *         </dependency>
     *
     *      2、配置文件，或者容器启动变量
     *          spring.cloud.inetutils.preferred-networks: 'xxx.xxx.xxx.'
     *
     *      3、获取IP
     *          String ip_ = inetUtils.findFirstNonLoopbackHostInfo().getIpAddress();
     **********************************************************************************************/

}
```

### 定义任务

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class LotteryXxlJob {
    private final IActivityDeploy activityDeploy;
    private final IStateHandler stateHandler;

    @XxlJob("lotteryActivityStateJobHandler")
    public void lotteryActivityStateJobHandler(){
        log.info("扫描活动状态 Begin");

        //以下定义你的业务逻辑
    }
}
```

### xxl-admin使用  
进入 xxl-admin 后台，`http://localhost:8071/xxl-job-admin`
默认账号密码 admin 123456

先到执行器管理-新增 填写对应信息保存
![pic](/middleware/xxl-job-01.png)

再到任务管理-新增 填写对应信息保存
执行器选择刚刚创建的执行器，JobHandler填写上一章节- 定义任务中`@XxlJob`注解中的值：`lotteryActivityStateJobHandler`
![pic](/middleware/xxl-job-02.png)

最后在任务管理中启动任务即可。