# 代理Bean注册到Spring容器
![pic](/spring/interview-28-2-1.png)
* 关于Bean注册的技术场景，在我们日常用到的技术框架中，MyBatis 是最为常见的。通过在使用 MyBatis 时都只是定义一个接口不需要写实现类，但是这个接口却可以和配置的 SQL 语句关联，执行相应的数据库操作时可以返回对应的结果。那么这个接口与数据库的操作就用到的 Bean 的代理和注册。
* 我们都知道类的调用是不能直接调用没有实现的接口的，所以需要通过代理的方式给接口生成对应的实现类。接下来再通过把代理类放到 Spring 的 FactoryBean 的实现中，最后再把这个 FactoryBean 实现类注册到 Spring 容器。那么现在你的代理类就已经被注册到 Spring 容器了，接下来就可以通过注解的方式注入到属性中。  

按照这个实现方式，我们来操作一下，看看一个 Bean 的注册过程在代码中是如何实现的。

## 定义接口
```java
public interface IUserDao{
    String queryUserInfo();
}
```
* 先定义一个类似 DAO 的接口，基本这样的接口在使用 MyBatis 时还是非常常见的。后面我们会对这个接口做代理和注册。
## 类代理实现 & 实现Bean工厂
```java
public class ProxyBeanFactory implements FactoryBean {

    @Override
    public Object getObject() throws Exception {

        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        Class[] classes = {IUserDao.class};
        /**
         *
         * Java 本身的代理方式使用起来还是比较简单的，用法也很固定。
		 * InvocationHandler 是个接口类，它对应的实现内容就是代理对象的具体实现。
		 * 最后就是把代理交给 Proxy 创建代理对象，Proxy.newProxyInstance 
		 * 这里用了lambda表达式，只有一个需要实现的方法时可以这样写，这里是实现了invoke方法
         **/
        InvocationHandler handler = (proxy, method, args) -> "你被代理了 " + method.getName();

        return Proxy.newProxyInstance(classLoader, classes, handler);
    }

    @Override
    public Class<?> getObjectType() {
        return IUserDao.class;
    }

}
```
* FactoryBean 在 spring 起到着二当家的地位，它将近有70多个小弟(实现它的接口定义)，那么它有三个方法:
  * T getObject() throws Exception: 返回bean实例对象
  * Class<?> getObjectType(): 返回实例类类型
  * boolean isSingleton(): 判断是否单例，单例会放到Spring容器中单实例缓存池中
* 在这里我们把上面使用Java代理的对象放到了 getObject() 方法中，那么现在再从 Spring 中获取到的对象，就是我们的代理对象了。

## Bean注册
```java
public class RegisterBeanFactory implements BeanDefinitionRegistryPostProcessor {

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {

        GenericBeanDefinition beanDefinition = new GenericBeanDefinition();
        beanDefinition.setBeanClass(ProxyBeanFactory.class);
        registry.registerBeanDefinition("userDao",beanDefinition);
        // 下面这样也可以
		// BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(beanDefinition, "userDao");
        // BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, registry);
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory configurableListableBeanFactory) throws BeansException {
    	//创建bean后后置处理
    }
}
```
在 Spring 的 Bean 管理中，所有的 Bean 最终都会被注册到类 DefaultListableBeanFactory 中，以上这部分代码主要的内容包括：

* 实现 BeanDefinitionRegistryPostProcessor.postProcessBeanDefinitionRegistry方法，获取 Bean 注册对象。
* 定义 Bean，GenericBeanDefinition，这里主要设置了我们的代理类工厂。
* 创建 Bean 定义处理类，BeanDefinitionHolder，这里需要的主要参数；定义 Bean 和名称 setBeanClass(ProxyBeanFactory.class)。
* 最后将我们自己的bean注册到spring容器中去，registry.registerBeanDefinition()

## 测试验证
### 定义 spring-config.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd">
<bean id="userDao" class="space.xiaoyuan.testSpringRegisterBean.RegisterBeanFactory"/>

</beans>
```  
  
### 测试
```java
public class TestMybatis {

    public static void main(String[] args) {
        BeanFactory beanFactory = new ClassPathXmlApplicationContext("spring-config.xml");
        IUserDao userDao = beanFactory.getBean("userDao", IUserDao.class);
        String res = userDao.queryUserInfo();
        System.out.println(res);
    }

}
```  

### 测试结果
```java
13:25:26.097 [main] DEBUG org.springframework.context.support.ClassPathXmlApplicationContext - Refreshing org.springframework.context.support.ClassPathXmlApplicationContext@1b701da1
13:25:26.217 [main] DEBUG org.springframework.beans.factory.xml.XmlBeanDefinitionReader - Loaded 1 bean definitions from class path resource [spring-config.xml]
13:25:26.235 [main] DEBUG org.springframework.beans.factory.support.DefaultListableBeanFactory - Creating shared instance of singleton bean 'userDao'
13:25:26.246 [main] DEBUG org.springframework.beans.factory.support.DefaultListableBeanFactory - Overriding bean definition for bean 'userDao' with a different definition: replacing [Generic bean: class [space.xiaoyuan.testSpringRegisterBean.RegisterBeanFactory]; scope=; abstract=false; lazyInit=false; autowireMode=0; dependencyCheck=0; autowireCandidate=true; primary=false; factoryBeanName=null; factoryMethodName=null; initMethodName=null; destroyMethodName=null; defined in class path resource [spring-config.xml]] with [Generic bean: class [space.xiaoyuan.testSpringRegisterBean.ProxyBeanFactory]; scope=; abstract=false; lazyInit=null; autowireMode=0; dependencyCheck=0; autowireCandidate=true; primary=false; factoryBeanName=null; factoryMethodName=null; initMethodName=null; destroyMethodName=null]
13:25:26.255 [main] DEBUG org.springframework.beans.factory.support.DefaultListableBeanFactory - Creating shared instance of singleton bean 'userDao'
你被代理了 queryUserInfo
```
* 从测试结果可以看到，我们已经可以通过注入到Spring的代理Bean对象，实现我们的预期结果。
* 其实这个过程也是很多框架中用到的方式，尤其是在一些中间件开发，类似的 ORM 框架都需要使用到。

## 总结
* 本章节的内容相对来说非常并不复杂，只不过这一块的代码是我们从源码的学习中提取出来的最核心流程，因为在大部分框架中也基本都是这样的进行处理的。如果这样的地方不了解，那么很难读懂诸如此类的框架源码，也很难理解它是怎么调用的。
* 在本文中主要涉及到的技术点包括；代理、对象、注册，以及相应的使用。尤其是 Bean 的定义 `BeanDefinitionHolder` 和 Bean 的注册 `BeanDefinitionReaderUtils.registerBeanDefinition。`
* 如果你还能把此类技术联想的更多，可以尝试把代理的对象替换成数据库的查询对象，也就是对JDBC的操作，当你完成以后也就实现了一个简单的ORM框架。其实很多技术实现都是由小做大，但最开始的那部分是整个代码实现的核心。

