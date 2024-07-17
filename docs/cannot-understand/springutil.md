# 抽象的SpringUtil
## 难理解之Hutool-SpringUtil注入失败
在项目中直接调用Hutool包里的SpringUtil，使用@Resource方式注入Bean，调用时抛**SpringUtil空指针异常**。然后笔者把Hutool-SpringUtil的代码原封不动的复制出来新建一个文件保存，嘿您猜怎么着？注入成功了！太抽象了
* **猜测原因：SpringBoot项目没扫描到Hutool包下的Bean。但是当时忘记验证了，只好作罢。**  

## 难理解之SpringUtil调用空指针
SpringUtil implements ApplicationContextAware 比 @PostConstruct 后初始化，导致@PostConstruct的初始化时调用SpringUtil报空指针异常。
* 嘿您猜怎么着！上一章节刚解决的问题，过了一天他就出现本章的调用**SpringUtil.getBean()中的applicationContext空指针异常**，前一天还好，隔天报错！一开电脑就错，十分抽象
* 猜测原因：@PostConstruct 比 ApplicationContextAware 先执行。
* 1. 采用解决方法：@DependsOn ，让@PostConstruct方法/类依赖于SpringUtil，您猜怎么着？嘿！不行，还是报错。十分抽象
* 2. 采用解决方法：@Order 让SpringUtil先初始化一步。嘿！您猜怎么着？还是不行，依然报错，十分抽象。
* 3. 采用解决方法：@Resource 把SpringUtil先行注入进包含@PostConstruct的类中。嘿！您猜怎么着！这次行了，太抽象了。
* TODO： 各种百度和问AI没得出原因，知识不够暂且作罢，改日拿我的大知识狠狠地蹂躏小小Spring
* 更新：静态方法不依赖于类所以你用@PostConstruct这个方法他并没有去加载这个bean，application context自然为空用@resource方式会强制加载所以没问题
* 更新：（**无效**）有人建议 放弃使用 @PostConstruct 转而使用 InitializingBean(目的是将初始化方法后置), 还是报applicationContext空指针异常 **(经查资料与验证，@PostConstruct方法是比实现 InitializingBean先执行的)**  
![pic](/cannot-understand/spring-init-02.png)
* 更新： 经过一个早上的研究，最终得出方法1 失败的原因：@DependsOn注解通常应该放在Spring管理的Bean上，因为它是用来指定Bean之间的依赖关系的。在实际使用中，通常将@DependsOn注解放在需要依赖其他Bean初始化的Bean上，以确保在初始化当前Bean之前先初始化所依赖的Bean。如果@DependsOn注解放在一个未被Spring管理的类上，它可能会被忽略，因为Spring只会处理被管理的Bean上的注解。**所以在方法1的基础上，将该类注册为Bean即可解决该问题。甚至说不要方法1的@DependsOn都可以**
### Spring的初始化顺序
![pic](/cannot-understand/spring-init-01.png)
```java
@Component
public class MyInitializingBean implements InitializingBean {

    public MyInitializingBean() {
        System.out.println("我是MyInitializingBean构造方法执行..."); //最先执行
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("我是afterPropertiesSet方法执行..."); //第三执行
    }

    @PostConstruct
    public void postConstruct() {
        System.out.println("我是postConstruct方法执行...");  //第二执行
    }

    public void init(){
        System.out.println("我是init方法执行..."); //最后执行
    }

    @Bean(initMethod = "init")
    public MyInitializingBean test() {
        return new MyInitializingBean();
    }
}
```

* 另一解决方法: [BeanFactoryPostProcessor详解](http://s.xiaoyuan.space/2EW9Hz)

### 扩展小知识
**1. ApplicationContextAware 需要注册为Spring的Bean才会被处理，在没有被注册为Bean的情况下，Spring也不会自动地将ApplicationContext传递给该类。**
### 问题总结
1. @SpringUtil需要注册为Bean，实现的ApplicationContextAware setApplication方法才会被执行(Hutool已注册为bean)
2. 使用了SpringUtil的类也要被Spring管理才行。总之，确保 StateConfig 类由 Spring 容器管理是为了避免由于 Bean 的初始化过程不受 Spring 容器控制而导致 @PostConstruct 方法无法被正确调用的问题。
  * 如果类不由 Spring 容器管理，那么它的初始化过程不受 Spring 容器控制，也就无法保证 @PostConstruct 方法被正确调用。而类的 init() 方法又依赖于 Spring 容器的上下文（通过调用 SpringUtils 获取 Bean），因此必须确保 StateConfig 类也被 Spring 容器管理，才能保证 init() 方法的正确执行。
3. 别人建议：少点使用@PostConstruct，改用InitializingBean