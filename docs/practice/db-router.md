# db-router  

最近写代码时遇到需要用到分库分表的场景，但是引入shardingsphere的话太重了，老板不允许，打算自己写一个轻量级的分库分表组件。

[gitee开源](https://gitee.com/xiaoyuan2000/n-db-router-spring-boot-starter)
## 实现步骤
### pom文件
因为要用到mybatis与SpringBoot，所以导入相关依赖
```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.4</version>
  </parent>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-configuration-processor</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-autoconfigure</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-aop</artifactId>
    </dependency>
    <!-- https://mvnrepository.com/artifact/org.mybatis.spring.boot/mybatis-spring-boot-starter -->
    <dependency>
      <groupId>org.mybatis.spring.boot</groupId>
      <artifactId>mybatis-spring-boot-starter</artifactId>
      <version>2.1.4</version>
    </dependency>
    <dependency>
      <groupId>mysql</groupId>
      <artifactId>mysql-connector-java</artifactId>
      <version>8.0.26</version>
    </dependency>
    <!-- https://mvnrepository.com/artifact/org.springframework.boot/spring-boot-test -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-test</artifactId>
      <scope>test</scope>
    </dependency>
    <!-- https://mvnrepository.com/artifact/org.springframework/spring-test -->
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>commons-beanutils</groupId>
      <artifactId>commons-beanutils</artifactId>
      <version>1.9.4</version>
    </dependency>
    <dependency>
      <groupId>commons-lang</groupId>
      <artifactId>commons-lang</artifactId>
      <version>2.6</version>
    </dependency>
    <dependency>
      <groupId>com.alibaba</groupId>
      <artifactId>fastjson</artifactId>
      <version>1.2.75</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.12</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <finalName>db-router-spring-boot-starter</finalName>
    <resources>
      <resource>
        <directory>src/main/resources</directory>
        <filtering>true</filtering>
        <includes>
          <include>**/**</include>
        </includes>
      </resource>
    </resources>
    <testResources>
      <testResource>
        <directory>src/test/resources</directory>
        <filtering>true</filtering>
        <includes>
          <include>**/**</include>
        </includes>
      </testResource>
    </testResources>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>2.12.4</version>
        <configuration>
          <skipTests>true</skipTests>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-resources-plugin</artifactId>
        <version>2.5</version>
        <configuration>
          <encoding>${project.build.sourceEncoding}</encoding>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>2.3.2</version>
        <configuration>
          <source>1.8</source>
          <target>1.8</target>
          <encoding>${project.build.sourceEncoding}</encoding>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-source-plugin</artifactId>
        <version>2.1.2</version>
        <executions>
          <execution>
            <id>attach-sources</id>
            <goals>
              <goal>jar</goal>
            </goals>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
```

### 自定义注解

路由注解、支持注解自定义分片键
#### 元注解Retention
**如果运行时没有被@Retention(RetentionPolicy.RUNTIME)元注解修饰，那么它在运行时将不可用。这意味着你将无法通过反射来获取或操作这个注解。**
> Java中的@Retention注解用于指定注解的保留策略，它有三个可选的保留策略：RetentionPolicy.SOURCE、RetentionPolicy.CLASS和RetentionPolicy.RUNTIME。其中，RetentionPolicy.RUNTIME表示注解将在运行时保留，并可以通过反射来访问和处理。
如果一个注解没有显式地使用@Retention注解，并且在运行时没有默认的保留策略为RetentionPolicy.RUNTIME，则它的保留策略将是默认的RetentionPolicy.CLASS，这意味着它将在编译时被保留在编译后的字节码文件中，但在运行时将不可用。
因此，如果你希望在运行时通过反射来获取和处理注解，你需要确保注解被@Retention(RetentionPolicy.RUNTIME)元注解修饰，否则它将无法在运行时使用。  

#### 代码实现
```java
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface DBRouter {
    String key() default "";
}
```

路由开关，用于控制是否某个表是否开启分库分表策略
```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface DBRouterStrategy {
    boolean enableSplitTable() default false;
}
```

### 动态数据源配置  
AbstractRoutingDataSource 是 Spring 中的一个抽象类，它是一个数据源路由抽象类，通常用于实现动态数据源切换或多数据源的场景。具体来说，它允许应用程序根据一些条件（例如线程绑定的数据源标识、请求参数、用户信息等）来动态地选择使用哪个数据源。

该类提供了一个抽象方法 determineCurrentLookupKey()，该方法需要被子类实现。子类需要根据具体的业务逻辑来决定当前应该使用的数据源的标识，比如数据源的名称或者其他标识符。AbstractRoutingDataSource 会根据 determineCurrentLookupKey() 返回的值来选择对应的数据源进行操作。

通常情况下，你需要创建一个继承自 AbstractRoutingDataSource 的子类，并且实现 determineCurrentLookupKey() 方法来指定数据源的选择逻辑。然后，将这个数据源路由器配置到 Spring 中，Spring 在执行数据库操作时会根据实际情况动态地选择数据源。

这种技术常用于实现读写分离、分库分表、多租户系统等场景，它使得应用程序可以根据实际需求动态地选择使用哪个数据源，从而提高了系统的灵活性和扩展性。
```java
public class DynamicDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        // 这里根据具体的逻辑来确定当前线程应该使用的数据源标识符
        // 例如，可以从ThreadLocal、请求参数等获取信息，并返回相应的数据源标识符
        return "db" + DBContextHolder.getDBKey();
    }
}
```

### 组件配置类
#### 需要注意的小坑与基础
* 如果需要编写yml时有提示，只能有一个构造函数，多一个就不出现提示。
* 在使用SpringBoot编写组件jar包时，因为没有使用`SpringBootApplication`注解，要使用`@ComponentScan`来配置扫描路径，用于扫描@Component注解
	* 因为`@SpringBootApplication`注解中包含了@ComponentScan
* 在自动注入属性时，`private Map<String, DBRouterConfigDetail> datasourceMap;` 注入失败，研究了很久发现是`DBRouterConfigDetail`没有写无参构造函数，因为属性注入会调用无参构造函数+setter方法注入属性。没有无参构造就无法构造又不报错，只会注入失败。导致属性为null
	* @ConfigurationProperties 注解通常会使用无参构造函数来创建对象，并通过 setter 方法来注入属性值。

#### 代码实现
```java
@Component()
@ConfigurationProperties(prefix = "mini-db-router.jdbc.datasource")
public class DBRouterConfig {
    /**
     * 分库数量
     */
    private int dbCount;
    /**
     * 分表数量
     */
    private int tbCount;
    /**
     * 默认分片键
     */
    private String routerKey;
    /**
     * 默认数据源
     */
    private String defaultDatasource;
    /**
     * 数据源map 
	*/
    private Map<String, DBRouterConfigDetail> datasourceMap;

    public Map<String, DBRouterConfigDetail> getDatasourceMap() {
        return datasourceMap;
    }

    public void setDatasourceMap(Map<String, DBRouterConfigDetail> datasourceMap) {
        this.datasourceMap = datasourceMap;
    }

    public String getDefaultDatasource() {
        return defaultDatasource;
    }

    public void setDefaultDatasource(String defaultDataSource) {
        this.defaultDatasource = defaultDataSource;
    }

    public int getDbCount() {
        return dbCount;
    }

    public void setDbCount(int dbCount) {
        this.dbCount = dbCount;
    }

    public int getTbCount() {
        return tbCount;
    }

    public void setTbCount(int tbCount) {
        this.tbCount = tbCount;
    }

    public String getRouterKey() {
        return routerKey;
    }

    public void setRouterKey(String routerKey) {
        this.routerKey = routerKey;
    }

    public DBRouterConfig() {
    }

    public DBRouterConfig(int dbCount, int tbCount, String routerKey, String defaultDatasource,Map<String,DBRouterConfigDetail> datasourceMap) {
        this.dbCount = dbCount;
        this.tbCount = tbCount;
        this.routerKey = routerKey;
        this.defaultDatasource = defaultDatasource;
        this.datasourceMap = datasourceMap;
    }
```

定义一个Holder用于保存线程变量
```java
public class DBContextHolder {
    private static final ThreadLocal<String> dbKey = new ThreadLocal<>();
    private static final ThreadLocal<String> tbKey =new ThreadLocal<>();
    public static void setDBKey(String dbKeyIdx){
        dbKey.set(dbKeyIdx);
    }

    public static String getDBKey(){
        return dbKey.get();
    }

    public static void setTBKey(String tbKeyIdx){
        tbKey.set(tbKeyIdx);
    }

    public static String getTBKey(){
        return tbKey.get();
    }

    public static void clearDBKey(){
        dbKey.remove();
    }

    public static void clearTBKey(){
        tbKey.remove();
    }
}
```

### 路由分库分表策略
定义策略接口
```java
public interface IDBRouterStrategy {
    /**
     * 路由计算
     *
     * @param dbKeyAttr 路由字段
     */
    void doRouter(String dbKeyAttr);

    /**
     * 手动设置分库路由
     *
     * @param dbIdx 路由库，需要在配置范围内
     */
    void setDBKey(int dbIdx);

    /**
     * 手动设置分表路由
     *
     * @param tbIdx 路由表，需要在配置范围内
     */
    void setTBKey(int tbIdx);

    /**
     * 获取分库数
     *
     * @return 数量
     */
    int dbCount();

    /**
     * 获取分表数
     *
     * @return 数量
     */
    int tbCount();

    /**
     * 清除路由
     */
    void clear();
}
```
hash分库分表策略实现类
```java
public class DBRouterStrategyHashCode implements IDBRouterStrategy {
    private final DBRouterConfig dbRouterConfig;
    private final Logger logger = LoggerFactory.getLogger(DBRouterStrategyHashCode.class);

    public DBRouterStrategyHashCode(DBRouterConfig dbRouterConfig) {
        this.dbRouterConfig = dbRouterConfig;
    }

    @Override
    public void doRouter(String dbKeyAttr) {
        int size = dbRouterConfig.getDbCount() * dbRouterConfig.getTbCount();
        // 扰动函数 & 分库分表量 得出下标
        //注入！注意！扰动函数是参考了hashmap源码，这种分片方法限定了size 必须为2的幂次方分库。（只是为了应用一下hashmap的扰动函数，可以新建一个策略取余计算）
        int idx = (dbKeyAttr.hashCode() ^ dbKeyAttr.hashCode() >>> 16) & (size - 1);
        // 补充视频教程；https://t.zsxq.com/0f8PDPWtK - 评论区还有计算的图稿
        /**
         * idx / dbRouterConfig.getTbCount() + 1 => 可以得出在哪个库，
         * 例如： 每个库4个分表，idx散列得出5，那么5/4 + 1 = 1+1 = 2，那么就在第二个库
         * idx 散列得出取值范围 0 ~ size -1 ，所以dbIdx最大不超过DbCount
         *
         * int tbIdx = idx - dbRouterConfig.getTbCount() * (dbIdx - 1);
         * 例如： 5 - 4 * 1 = 1 在第一个表
         */
        int dbIdx = idx / dbRouterConfig.getTbCount() + 1;
        int tbIdx = idx - dbRouterConfig.getTbCount() * (dbIdx - 1);
        DBContextHolder.setDBKey(String.format("%02d", dbIdx));
        DBContextHolder.setTBKey(String.format("%03d", tbIdx));
        logger.debug("数据库路由 dbIdx：{} tbIdx：{}",  dbIdx, tbIdx);

    }

    @Override
    public void setDBKey(int dbIdx) {
        DBContextHolder.setDBKey(String.format("%02d",dbIdx));
    }

    @Override
    public void setTBKey(int tbIdx) {
        DBContextHolder.setTBKey(String.format("%03d",tbIdx));
    }

    @Override
    public int dbCount() {
        return dbRouterConfig.getDbCount();
    }

    @Override
    public int tbCount() {
        return dbRouterConfig.getTbCount();
    }

    @Override
    public void clear() {
        DBContextHolder.clearDBKey();
        DBContextHolder.clearTBKey();
    }
}
```
如果需要其他分库分表策略则新建一个策略实现接口即可。

### mybatis自定义拦截器
用于拦截修改sql，注释已经写好
```java
//@Intercepts({@Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class})})
//拦截          StatementHandler 的使用Connection.class, Integer.class的 prepare方法
@Intercepts({@Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class})})
public class DynamicMybatisPlugin implements Interceptor {
    private final Pattern pattern = Pattern.compile("(from|into|update)[\\s]{1,}(\\w{1,})", Pattern.CASE_INSENSITIVE);

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        //获取statementHandler invocation拦截了类注解上的配置
        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        //调用MetaObject.forObject 操作statementHandler 里的属性，避免直接使用了java反射，提高可读性
        MetaObject metaObject = MetaObject.forObject(statementHandler, SystemMetaObject.DEFAULT_OBJECT_FACTORY, SystemMetaObject.DEFAULT_OBJECT_WRAPPER_FACTORY, new DefaultReflectorFactory());
        MappedStatement mappedStatement = (MappedStatement) metaObject.getValue("delegate.mappedStatement");

        // 获取自定义注解判断是否进行分表操作
        //MappedStatement 的 ID 是由 namespace 和 statement 的 ID 组成的。它的格式通常是 namespace.statementId。
        //namespace 是 Mapper 接口的完全限定名，或者是 Mapper XML 文件的命名空间。
        //statementId 是 Mapper 接口中的方法名，或者是 Mapper XML 文件中 SQL 语句的 ID。
        String id = mappedStatement.getId();
        //把statementId去掉 即把方法名去掉，留下mapper接口的全限定名称
        String className = id.substring(0, id.lastIndexOf("."));
        Class<?> clazz = Class.forName(className);
        // 获取自定义注解判断是否进行分表操作
        DBRouterStrategy annotation = clazz.getAnnotation(DBRouterStrategy.class);
        if(null == annotation || !annotation.enableSplitTable()){
            //没有用DBRouterStrategy 或者 没开启分库分表 直接返回
            return invocation.proceed();
        }

        //从 statementHandler获取出sql
        BoundSql boundSql = statementHandler.getBoundSql();
        String sql = boundSql.getSql();

        //替换表名
        Matcher matcher = pattern.matcher(sql);
        String tableName = null;
        if (matcher.find()) {
            //匹配上了正则
            tableName = matcher.group().trim();
        }
        String actualSql = matcher.replaceAll(tableName + "_" + DBContextHolder.getTBKey());
        //获取字段
        Field sqlField = boundSql.getClass().getDeclaredField("sql");
        sqlField.setAccessible(true);
        //修改boundSql对象的“sql”字段为actualSql
        sqlField.set(boundSql,actualSql);
        sqlField.setAccessible(false);

        return invocation.proceed();
    }


}
```


### 自动装配数据源
```java
@Configuration
@ComponentScan(basePackages = "space.xiaoyuan.middleware.db.router")
public class DataSourceAutoConfig{
    @Resource
    private DBRouterConfig dbRouterConfig;
    /**
     * 默认数据源配置
     */
    @Bean()
    public IDBRouterStrategy routerStrategy(){
        return new DBRouterStrategyHashCode(dbRouterConfig);
    }
    @Bean("db-router-point")
    @ConditionalOnMissingBean
    public DBRouterJoinPoint joinPoint(IDBRouterStrategy routerStrategy){
        return new DBRouterJoinPoint(dbRouterConfig,routerStrategy);
    }

    @Bean()
    public Interceptor mybatisPlugin(){
        return new DynamicMybatisPlugin();
    }

    @Bean()
    public DataSource dataSource(){
        Map<Object,Object> targetDataSources = new HashMap<>();
        dbRouterConfig.getDatasourceMap().forEach((key,value)->{
            targetDataSources.put(key,new DriverManagerDataSource(
                    value.getUrl(),
                    value.getUsername(),
                    value.getPassword()
                    ));
        });

        DynamicDataSource dynamicDataSource = new DynamicDataSource();
        dynamicDataSource.setTargetDataSources(targetDataSources);
        dbRouterConfig.getDatasourceMap().get(dbRouterConfig.getDefaultDatasource());

        DBRouterConfigDetail dbRouterConfigDetail = dbRouterConfig.getDatasourceMap().get(dbRouterConfig.getDefaultDatasource());
        dynamicDataSource.setDefaultTargetDataSource(new DriverManagerDataSource(
                dbRouterConfigDetail.getUrl(),
                dbRouterConfigDetail.getUsername(),
                dbRouterConfigDetail.getPassword())
        );

        return dynamicDataSource;
    }

    /**
     * 事务管理器
     * 当初这个Bean写错名字，写成transactionManager 导致报错找不到这个Bean
     */
    @Bean
    public TransactionTemplate transactionTemplate(DataSource dataSource){
        DataSourceTransactionManager dataSourceTransactionManager = new DataSourceTransactionManager();
        dataSourceTransactionManager.setDataSource(dataSource);

        TransactionTemplate transactionTemplate = new TransactionTemplate();
        //设置事务传播级别
        transactionTemplate.setPropagationBehavior(DefaultTransactionDefinition.PROPAGATION_REQUIRED);
        //设置事务管理器
        transactionTemplate.setTransactionManager(dataSourceTransactionManager);
        return transactionTemplate;
    }
}
```

### aop切面
```java
@Aspect
public class DBRouterJoinPoint {
    @Pointcut("@annotation(space.xiaoyuan.middleware.db.router.annotation.DBRouter)")
    public void aopPoint(){

    }
    private final Logger logger = LoggerFactory.getLogger(DBRouterJoinPoint.class);
    public DBRouterJoinPoint(DBRouterConfig dbRouterConfig, IDBRouterStrategy routerStrategy) {
        this.dbRouterConfig = dbRouterConfig;
        this.routerStrategy = routerStrategy;
    }

    private final DBRouterConfig dbRouterConfig;
    private final IDBRouterStrategy routerStrategy;


    /**
     * 在 @Around 注解的方法中，可以将目标方法的参数声明为一个 DBRouter 类型的参数，这样 Spring AOP 就会自动将匹配的注解实例传递给该参数。
     * @param pjp
     * @param dbRouter
     * @return
     */
    @Around("aopPoint() && @annotation(dbRouter)")
    public Object doRouter(ProceedingJoinPoint pjp, DBRouter dbRouter) throws Throwable {
        String routerKey = dbRouter.key();
        if(StringUtils.isBlank(routerKey) && StringUtils.isBlank(dbRouterConfig.getRouterKey())){
            throw new RuntimeException("annotation DBRouter key is null!");
        }
        Object[] args = pjp.getArgs();
        //根据分片键获取值
        String routerKeyVal = getAttrValue(routerKey, args);
        routerStrategy.doRouter(routerKeyVal);
        try{
            return pjp.proceed();
        }finally {
            routerStrategy.clear();
        }
    }

    public String getAttrValue(String attr, Object[] args) {
        if (1 == args.length) {
            Object arg = args[0];
            if (arg instanceof String) {
                return arg.toString();
            }
        }

        String filedValue = null;
        for (Object arg : args) {
            try {
                if (StringUtils.isNotBlank(filedValue)) {
                    break;
                }
                // filedValue = BeanUtils.getProperty(arg, attr);
                // fix: 使用lombok时，uId这种字段的get方法与idea生成的get方法不同，会导致获取不到属性值，改成反射获取解决
                filedValue = String.valueOf(this.getValueByName(arg, attr));
            } catch (Exception e) {
                logger.error("获取路由属性值失败 attr：{}", attr, e);
            }
        }
        return filedValue;
    }

    /**
     * 获取对象的特定属性值
     *
     * @author tang
     * @param item 对象
     * @param name 属性名
     * @return 属性值
     */
    private Object getValueByName(Object item, String name) {
        try {
            Field field = getFieldByName(item, name);
            if (field == null) {
                return null;
            }
            field.setAccessible(true);
            Object o = field.get(item);
            field.setAccessible(false);
            return o;
        } catch (IllegalAccessException e) {
            return null;
        }
    }

    /**
     * 根据名称获取方法，该方法同时兼顾继承类获取父类的属性
     *
     * @author tang
     * @param item 对象
     * @param name 属性名
     * @return 该属性对应方法
     */
    private Field getFieldByName(Object item, String name) {
        try {
            Field field;
            try {
                field = item.getClass().getDeclaredField(name);
            } catch (NoSuchFieldException e) {
                field = item.getClass().getSuperclass().getDeclaredField(name);
            }
            return field;
        } catch (NoSuchFieldException e) {
            return null;
        }
    }

}
```

### 自动装配
在resources/META-INF目录下创建spring.factories并写入`org.springframework.boot.autoconfigure.EnableAutoConfiguration=space.xiaoyuan.middleware.db.router.config.DataSourceAutoConfig` 即可自动装配DataSourceAutoConfig

### 使用方式
在需要使用该分库分表组件的pom文件中引入依赖
```xml
<dependency>
        <groupId>space.xiaoyuan.middleware</groupId>
        <artifactId>n-db-router-spring-boot-starter</artifactId>
        <version>1.0-SNAPSHOT</version>
      </dependency>
```
并添加配置文件
```yaml
mini-db-router:
  jdbc:
    datasource:
      db-count: 2
      tb-count: 4
      router-key: uId
      default-datasource: db00
      datasource-map:
        db00:
          driver-class-name: com.mysql.jdbc.Driver
          url: jdbc:mysql://127.0.0.1:3306/lottery?useUnicode=true
          username: root
          password: password
        db01:
          driver-class-name: com.mysql.jdbc.Driver
          url: jdbc:mysql://127.0.0.1:3306/lottery?useUnicode=true
          username: root
          password: password
        db02:
          driver-class-name: com.mysql.jdbc.Driver
          url: jdbc:mysql://127.0.0.1:3306/lottery?useUnicode=true
          username: root
          password: password
```
最后在需要分库分表的dao层中写入注解开启
```java
@Mapper
@DBRouterStrategy(enableSplitTable = true)
public interface IUserStrategyExportDao {

    /**
     * 新增数据
     * @param userStrategyExport 用户策略
     */
    @DBRouter(key = "uId")
    void insert(UserStrategyExport userStrategyExport);

    /**
     * 查询数据
     * @param uId 用户ID
     * @return 用户策略
     */
    //没有指定key 就用配置文件中的默认分片键
    @DBRouter
    UserStrategyExport queryUserStrategyExportByUId(String uId);
}
```

### 实现逻辑剖析
1. 先使用配置类注入对应的多数据源、分库分表配置，创建一个继承自 `AbstractRoutingDataSource `的子类，并且实现 `determineCurrentLookupKey()` 方法来指定数据源的选择逻辑。然后，将这个数据源路由器配置到 Spring 中，Spring 在执行数据库操作时会根据实际情况动态地选择数据源。
2. 然后实现一个aop切面，对自定义注解`@DBRouter`进行拦截处理，从自定义注解`@DBRouter`中获取分片键key，然后反射从切点获取args中key对应的value。例如：uId:12345,这个uId就是DBRouter里的key，12345就是从切点args里传入的value。然后调用分片策略`IDBRouterStrategy`进行分库分表计算并存入ThreadLocal中，供给Mybatis自定义拦截器插件以及步骤1的动态数据源选择使用
3. mybatis自定义拦截器插件中通过statementHandleer获取对应的执行mapper以及执行方法。再判断该mapper是否有开启分库分表策略，有的话就从步骤2的ThreadLocal中获取分表键，至于分库在步骤1的spring配置中会自动切换。  
![pic](/practice/db-router/Fm85ZCdK6YBuTtBgBglPC5EME4Vo.png)

---
## 项目介绍
### 为什么要自研？
1. 维护性:市面的路由组件比如 `shardingsphere` 但过于庞大，还需要随着版本做一些升级。而我们需要更少的维护成本。
2. 扩展性:结合自身的业务需求，我们的路由组件可以分库分表、自定义路由协议，扫描指定库表数据等各类方式。研发扩展性好，简单易用。
3. 安全性:自研的组件更好的控制了安全问题，不会因为一些额外引入的jar包，造成安全风险。

当然，我们的组件主要是为了更好的适应目前系统的诉求，所以使用自研的方式处理。就像shardingsphere 的市场占有率也不是 100% 那么肯定还有很多公司在自研，甚至各个大厂也都自研一整套分布式服务，来让自己的系统更稳定的运行。分库分表基本是单表200万，才分。

### 组件介绍
- **项目名称**：DB-Router 数据库路由组件
- **系统架构**：基于 AOP、Spring 动态数据源切换、MyBatis 插件开发、散列算法等技术，实现的 SpringBoot Starter 数据库路由组件
- **核心技术**：AOP、AbstractRoutingDataSource、MyBatis Plugin StatementHandler、扰动函数、哈希散列、ThreadLocal
- **项目描述**：此组件项目是为了解决在分库分表场景下，开发一款可以应对自身业务场景多变特性，即支持个性的分库分表、只分库或者只分表以及双字段控制分库和分表，也可以自定义扩展监控、扫描、策略等规则，同时又能满足简单维护迭代的数据库路由组件。<!-- 这块路由组件在设计实现上除核心技术外，还进行了严格雪崩标准(SAC) 测试，确保数据的散列效果。 -->
- **我的职责**：
  - 设计分库分表数据库路由组件的架构模型结构，运用设计模式对这块组件进行功能的分治和实现。
  <!-- - 调研平方散列、除法散了、乘法散列、哈希散列以及斐波那契散列，并结合雪崩测试，选择了一块适合数据库路由的散列算法，并做功能的开发实现。 -->
  - 引入 MyBatis Plugin 插件开发功能，对执行的 SQL 语句动态变更表信息，做到执行对应表的策略设计。同时扩展了监控和日志功能，方便在调试和验证时，可以打印相关SQL语句。

---
## 使用事项
### 声明式事务失效问题
* 场景介绍
    * AbstractRoutingDataSource有3个数据源:db00,db01,db02。是否存在一种情况，@Transactional开启事务时会在默认数据源db00开启，然后我执行sql时切换数据源为db01,这个时候@Transactional的事务就失效了吗？
* 场景回答
    * 如果在@Transactional注解标记的方法内部切换了数据源，@Transactional的事务管理可能会失效。在您描述的情况下，如果@Transactional开启事务时使用的是默认数据源db00，而后在方法内部手动切换数据源到db01，那么@Transactional所管理的事务可能会失效。
    * 这是因为@Transactional注解通常会在方法开始时开启事务，并将事务绑定到当前线程中的事务上下文中，同时使用默认的数据源。当切换数据源时，可能会导致事务管理的混乱，因为事务管理器与新的数据源不一致。
    * 因此，在使用AbstractRoutingDataSource和@Transactional一起时，需要确保在一个事务中始终使用一致的数据源，并避免在事务内部切换数据源，以保证事务管理的正确性和可靠性。
* **组件使用建议**
    * 使用编程式事务：  
    ```java
    //注入bean 可以用构造器注入，这里节选代码就用@Resource了，先根据名字注入再根据类型
    @Resource
    private TransactionTemplate transactionTemplate;
    @Resource
    private IDBRouterStrategy dbRouter;
    //进行路由
    dbRouter.doRouter(partake.getuId());
    //执行事务
    transactionTemplate.execute(status -> {
        //回滚事务
        status.setRollbackOnly();
        //如果不手动回滚/抛出异常则会自动提交事务
        //可以return 自定义返回值
        return new Object();
    });
    ```
<!-- ## 组件技术问题
简单技术问题：

1. 什么是 AOP？在 DB-Router 中如何应用 AOP？
2. AbstractRoutingDataSource 是什么？它的作用是什么？
3. ThreadLocal 是什么？在 DB-Router 中是如何使用的？
4. 什么是哈希散列？在 DB-Router 中为什么选择了哈希散列算法？
5. SAC 测试是什么？在 DB-Router 中如何应用 SAC 测试？

中等技术问题：

1. 什么是 MyBatis Plugin？在 DB-Router 中如何应用 MyBatis Plugin 实现动态变更表信息？
2. 分库分表的散列算法有哪些，各自的优缺点是什么？
3. 在 DB-Router 中如何支持个性化的分库分表控制？请结合具体实例说明。
4. 在 DB-Router 中如何实现扩展监控、扫描、策略等规则？
5. 什么是雪崩测试？在 DB-Router 中如何进行雪崩测试？

难度技术问题：

1. 在 DB-Router 的架构模型中，如何实现扩展性和灵活性的平衡？
2. 在 DB-Router 中如何保证数据路由的高效性和准确性？
3. 在 DB-Router 中，如何避免分库分表后产生的性能问题？
4. 在 DB-Router 中如何应对高并发的场景？请结合具体实例说明。
5. 在 DB-Router 的设计过程中，遇到了哪些技术难点？是如何解决的？ -->