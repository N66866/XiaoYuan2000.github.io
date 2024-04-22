# BeanFactory和FactoryBean的区别
## BeanFactory
`BeanFactory` 是 Spring 容器的顶级接口，它表示 Spring 框架中用于管理 Bean 生命周期的核心组件，被官方称为 IOC 容器。
它负责创建、配置和管理程序中所有的 Bean 实例。甚至 ApplicationContext 都是它的子接口，因此，从某种程度上来说，我们一般提到的 "Spring 容器" 其实指就是它。
`BeanFactory` 是最顶级的接口，里面定义了获取和创建 Bean 的最基本方法，它下面又根据功能和抽象级别细分五个接口：
* `ListableBeanFactory`：扩展了对 Bean 的批量操作，比如获取所有 Bean 的名称，或者按照类型获取 Bean 等（我们常用的 `getBeansOfType` 方法就是它提供的）。
* `HierarchicalBeanFactory`：用于支持层次性的 `BeanFactory` 结构，从而实现 `BeanFactory` 的嵌套，形成父子关系。
* `AutowireCapableBeanFactory`：用于提供提供对 Bean 自动装配的支持。
* `ConfigurableBeanFactory`：它继承了 AutowireCapableBeanFactory 和 SingletonBeanRegistry ，用于提供包括 `Scope` 管理、类加载器、上级工厂、表达式解析器……等等各种配置项。
* `ConfigurableListableBeanFactory`：继承了 `ConfigurableBeanFactory` 和 `ListableBeanFactory`，是集全部 `BeanFactory` 接口之大成者。
它的最底层实现类是 `DefaultListableBeanFactory`，它直接或间接实现了所有 `BeanFactory` 接口，是在项目中最常用的实现类。

### 1.基本概念
`BeanFactory` 是 Spring 中用于管理 Bean 生命周期的核心组件，Spring 官方文档将其称为 IOC 容器，它即是我们一般俗称的 “Spring 容器”，Bean 的注册、实例化、初始化、依赖注入以及销毁等环节都是通过它完成的。
它的最下级实现类即为 `DefaultListableBeanFactory`，我们在 Spring 或者 SpringBoot 中基本上所有的 `BeanFactory` 使用的都是它。
![pic](/spring/spring-001.png)

> 当我们谈到 BeanFactory 的时候，实际上谈的不止是 BeanFactory 接口本身，而是以 BeanFactory 为基础扩展出的这一套体系。如果我们继续往下看，会发现 BeanFactory的更下层就是 ApplicationContext ，它对应着一个更大的体系。

### BeanFactory
`BeanFactory` 是 Spring 容器的顶级接口，它表示 Spring 框架中用于管理 Bean 生命周期的核心组件，被官方称为 IOC 容器。
它负责创建、配置和管理程序中所有的 Bean 实例。甚至 ApplicationContext 都是它的子接口，因此，从某种程度上来说，我们一般提到的 "Spring 容器" 其实指就是它。
`BeanFactory` 是最顶级的接口，里面定义了获取和创建 Bean 的最基本方法，它下面又根据功能和抽象级别细分五个接口：
* `ListableBeanFactory`：扩展了对 Bean 的批量操作，比如获取所有 Bean 的名称，或者按照类型获取 Bean 等（我们常用的 `getBeansOfType` 方法就是它提供的）。
* `HierarchicalBeanFactory`：用于支持层次性的 `BeanFactory` 结构，从而实现 `BeanFactory` 的嵌套，形成父子关系。
* `AutowireCapableBeanFactory`：用于提供提供对 Bean 自动装配的支持。
* `ConfigurableBeanFactory`：它继承了 AutowireCapableBeanFactory 和 SingletonBeanRegistry ，用于提供包括 `Scope` 管理、类加载器、上级工厂、表达式解析器……等等各种配置项。
* `ConfigurableListableBeanFactory`：继承了 `ConfigurableBeanFactory` 和 `ListableBeanFactory`，是集全部 `BeanFactory` 接口之大成者。
它的最底层实现类是 `DefaultListableBeanFactory`，它直接或间接实现了所有 `BeanFactory` 接口，是在项目中最常用的实现类。
在 3.1 以及更早的版本之前，Spring 提供了 XmlBeanFactory 它是 DefaultListableBeanFactory 唯一一个子类，等同于在前者的基础上附加一个从 XML 文件加载 Bean 定义的功能。
不过，在更高版本 Spring 则推荐直接使用 ApplicationContext + DefaultListableBeanFactory 的方案，BeanFactory 回归单一职责，只负责管理 Bean，而资源的加载则交给 ApplicationContext实现的其他接口。  

> 顺带一提，关于如何基于 AutowireCapableBeanFactory 对非 Spring 管理的对象进行依赖注入，请参见：**todo**

---
### SingletonBeanRegistry
`SingletonBeanRegistry` 表示表示单例 Bean 的注册表，它是一个顶级接口，实现该接口的类具备管理单例 Bean 的功能。`ConfigurableBeanFactory`接口继承了它，因此所有的 `BeanFactory` 对单例 Bean 的管理功能都源于此。
从 `SingletonBeanRegistry` 的体系来说，主要分为两层：
* `DefaultSingletonBeanRegistry`：它是 SingletonBeanRegistry 的通常实现，我们经常提到的三级缓存实际上就是在它里面，单例 Bean 的销毁操作也要基于它完成。
* `BeanFactoryRegisterSupport`：它是基于 DefaultSingletonBeanRegistry 扩展的抽象类，用于在前者的基础上额外为 `FactoryBean` 提供支持（毕竟 `FactoryBean` 也可以算是单例 Bean）。它的内部有一个 `factoryBeanObjectCache`，FactoryBean 的单例产物就缓存于此。
`DefaultSingletonBeanRegistry` 为所有的 BeanFactory 提供了管理单例的能力，而 `BeanFactoryRegisterSupport` 则令 BeanFactory 在前者的基础上具备管理 `FactoryBean` 产物的能力。

---
### BeanDefinitionRegistry
`BeanDefinitionRegistry` 是 Spring 中用于注册和管理 bean 定义的接口。
bean 定义即 `BeanDefinition`，它相当于 Spring 容器中 Bean 的元数据，它可以告知 Spring 容器这个 Bean 里面具备哪些属性，具备哪些方法，需要哪些依赖，要如何创建……等等，它与 Bean 的关系等同于 Java 类与根据类创建出的对象的关系。  

> 关于 BeanDefinition，具体请参见：**todo**: 什么是 BeanDefinition？  

Spring 的 `BeanFactory` 接口体系中并没有接口继承它，不过 `BeanFactory` 体系中最底层，也是最常用的实现类 `DefaultListableBeanFactory` 实现了这个接口。
除此之外， `ApplicationContext` 的通用实现类 `GenericApplicationContext` 也实现了这个接口，而大部分的 `ApplicationContext` 又继承了 `GenericApplicationContext。`
总而言之， `BeanDefinitionRegistry` 和前两者一样，都是 Spring 容器体系中的重要组成部分。

---

## FactoryBean
Spring 中的 `FactoryBean` 是一个特殊的接口，实现了该接口的 Bean 变为专门用来创建某种特定类型对象的工厂。
[如何向Spring注册bean之FactoryBean使用](./Spring-registerBean)    

当你将一个实现了 FactoryBean 接口的类注册到 Spring 容器时，Spring 会默认调用其 getObject 方法来获取实际的 bean 实例。FactoryBean 接口定义了一个方法 getObject，该方法返回由 FactoryBean 所管理的实际 bean 实例。

当你在 Spring 容器中声明一个 FactoryBean 的实现类时，实际上容器中注册的是 FactoryBean 的实例而不是其 getObject 方法返回的对象。Spring 容器在需要获取该 bean 实例时，会调用 FactoryBean 的 getObject 方法，以获取实际的 bean 实例。

这种机制允许 FactoryBean 在创建 bean 实例时进行一些复杂的逻辑，例如根据特定条件来决定返回不同的 bean 实例，或者在返回实例之前进行一些初始化操作。

它被广泛用于创建一些：
* 无法通过正常的构造函数创建的对象：比较典型的是各种代理，比如 Dubbo 使用 `ReferenceBean` 创建 RPC 接口的代理对象，Mybatis 使用 `MapperFactoryBean` 来创建 Mapper 接口代理。
* 创建过程比较复杂的对象：比较典型的是 `SqlSession` ， 比如 JPA 和 Myabtis 都选择通过一个 `SqlSessionFactoryBean` 来创建它。
该接口中定义了三个方法，分别是：
* getObject ：用于从工厂中获取一个 Bean 实例。
* getObjectType：获取实例的类型。
* isSingleton：判断这个 Bean 是否是单例的。（默认值为true）  

通常情况下，如果 `FactoryBean` 的 isSingleton 方法返回 true，则其生产的对象就会是单例的，反之则为多例的。不过，如果 `FactoryBean` 本身是多例的，那么无论isSingleton 方法是否返回 true， 其产物也将变为多例的。
我们可以通过 `FactoryBean` 的 beanName 从 Spring 容器获得其生产的对象，而当需要从 Spring 容器中获取 `FactoryBean` 本身时，需要在 beanName 前加 & 符号。

### FactoryBean 的 beanName 机制
我们都知道，Spring 容器中所有的 Bean 都有独一无二的 beanName 作为唯一标识，而 `FactoryBean` 作为一种特殊的 Bean，它的 beanName 代表的除了 `FactoryBean` 本身外，还代表它的产物 Bean。
在正常情况下，当我们从 Spring 容器通过 `FactoryBean` 的 beanName 获取 Bean 时，将会得到 `FactoryBean` 生产的产品，而不是 `FactoryBean` 本身，如果要获得 `FactoryBean` 本身，则需要在 beanName 前面加一个 '&' 号。
例如：
```java
@Component("foo")
public static class FooFactoryBean implements FactoryBean<FooFactoryBean.Foo> {
    
    @Override
    public Foo getObject() throws Exception {
        System.out.println("创建了一个Foo!");
        return new Foo();
    }
    
    @Override
    public Class<?> getObjectType() {
        return Foo.class;
    }

    public static class Foo {}
}

@Component
public class Example {

    @Autowired
    private ApplicationContext context;

    public void run() {
        // 通过 'foo' 获得产物 Foo
        FooFactoryBean.Foo foo = (FooFactoryBean.Foo)context.getBean("foo");
        // 通过 '&foo' 获得 FooFactoryBean
        FactoryBean<Foo> fooFactoryBean = (FactoryBean<Foo>)context.getBean("&foo");
    }
}
```
> 源码中的 `AbstractBeanFactory` 有一个专门的方法 `transformedBeanName` 用来干这件事情，它在 `doGetBean` 方法中调用。  

此外，由于 Spring 只管理 `FactoryBean` 本身的生命周期而不关心其产物的生命周期， 因此如果你的 `FactoryBean` 的产物本身还是一个 `FactoryBean` ，那实际就产物的就会被视为一个普通的 Bean，而不会视为一个 `FactoryBean。`

例如：
```java
// 在上述基础上再套娃一层
@Component("foo")
public static class FooFactoryBeanFactoryBean implements FactoryBean<FooFactoryBean> {

    @Override
    public FooFactoryBean getObject() throws Exception {
        System.out.println("创建了一个FooFactoryBean!");
        return new FooFactoryBean();
    }

    
    @Override
    public Class<?> getObjectType() {
        return FooFactoryBean.class;
    }
}

@Component
public class Example {

    @Autowired
    private ApplicationContext context;

    public void run() {
        // 通过 'foo' 获得产物 FactoryBean
        context.getBean("foo"); // == FooFactoryBean
        // 通过 '&foo' 获得 FooFactoryBeanFactoryBean
        context.getBean("&foo"); // == FooFactoryBeanFactoryBean
    }
}
```
在上面这个例子中，我们通过 `foo` 只能够得到下一级产物 `FooFactoryBean` ，而无法真正的得到我们想要的最下级产物 `Foo`

### 生命周期
按源码中的注释来说，`Spring` 只管理 `FactoryBean` 的生命周期，而不管理其产物的生命周期。
简而言之，`FactoryBean `本身像普通的 Bean 一样，会经过各种 `BeanPostProcessor` 的后处理，并且也支持 `InitializingBean、DisposableBean` 以及 `Aware` 等各种回调接口。
而对于 `FactoryBean` 的产物来说，它则除了 `BeanPostProcessor` 的 `postProcessAfterInitialization` 外皆不支持。
这一部分内容在源码中的 `FactoryBeanRegistrySupport`.`getObjectFromFactoryBean` 方法可以找到答案：
```java
protected Object getObjectFromFactoryBean(
    FactoryBean<?> factory, String beanName, boolean shouldPostProcess) {
    
    // ... ...
    
    Object object = doGetObjectFromFactoryBean(factory, beanName);
    if (shouldPostProcess) {
        try {
            // 对产物进行后处理
            object = postProcessObjectFromFactoryBean(object, beanName);
        }
        catch (Throwable ex) {
            throw new BeanCreationException(beanName, "Post-processing of FactoryBean's object failed", ex);
        }
    }
    return object;
    
    // ... ...
}

// AbstractAutowireCapableBeanFactory 实现了这个方法
protected Object postProcessObjectFromFactoryBean(Object object, String beanName) {
    // 调用 BeanPostProcessor 的 postProcessAfterInitialization 方法
    return applyBeanPostProcessorsAfterInitialization(object, beanName);
}
```
**作用有限的后处理**
实际上，由于缺少前置步骤 `postProcessBeforeInitialization` 而只有后置步骤 `postProcessAfterInitialization` ，这导致而很多需要两步协作的后处理器无法正常生效。
例如，用于依赖注入的 `AutowiredAnnotationBeanPostProcessor` 后处理器无法正常处理它，因此产物 Bean 无法基于 `@Autowired` 注解进行依赖注入。
不过，还是有一些仅依赖后置步骤的处理器是可以生效的，比如几个基于 `AbstractAdvisingBeanPostProcessor` 实现后处理器：
* `AsyncAnnotationBeanPostProcessor` ：用于基于 @Async注解实现异步调用。
* `MethodValidationPostProcessor` ：基于 JSR303 注解实现参数校验（比如我们属性的 @NotNull）。

```java
@Component("foo")
public static class FooFactoryBean implements FactoryBean<FooFactoryBean.Foo> {
    @Override
    public Foo getObject() throws Exception {
        System.out.println("创建了一个Foo!");
        return new Foo();
    }
    @Override
    public Class<?> getObjectType() {
        return Foo.class;
    }

    // 添加 @Async 注解，则 Foo 将会被 Spring 代理
    public static class Foo {
        private ApplicationContext applicationContext;
        @Async
        public void test() {}
    }
}


@Component
public class Example {

    @Autowired
    private ApplicationContext context;

    public void test() {
        // 获取的 foo 被 Spring 代理了
        Object foo = context.getBean("foo"); // Test$FooFactoryBean$Foo$$EnhancerBySpringCGLIB$$7887ae4f
    }
}
```

---
### 作用域
`FactoryBean` 的作用域可以像正常的 Bean 那样通过 @Scope 配置，而对于它的产物则需要通过内部的 `isSingleton` 方法来控制。

当然，事无绝对，如果我们把 `FactoryBean` 设置为多例的，那么即使 `isSingleton` 返回 true，两者也依然都是多例的。

这一块的逻辑实际上由 FactoryBeanRegistrySupport.getObjectFromFactoryBean 方法控制，在这个方法中，Spring 检查的目标 `FactoryBean` 是否是单例的，如果是单例的则尝试从缓存中获取，否则直接创建一个新的。

### 产物的加载时机
我们知道，Spring 中的单例 Bean 会在容器启动的时候通过 `ConfigurableListableBeanFactory.preInstantiateSingletons` 全部加载，而 `FactoryBean` 的产物则与普通的 Bean 有所不同：
* 延迟加载：在正常情况下，产物 Bean 并不会随其他正常的 Bean 初始化，只会在被从 Spring 容器中获取的时候才会触发，比如被依赖注入到其他的 Bean 里。
* `SmartFactoryBean` 中显式指定提前初始化：如果 `FactoryBean` 又实现了 `SmartFactoryBean` 接口，并重写 `isEagerInit` 方法令其返回 true，那么它将会在它的 `FactoryBean` 初始化后进行初始化。
* 获取产物 Bean 类型导致提前初始化：如果 `FactoryBean` 的 `getBeanType` 返回 null，那么当调用 `BeanFactory` 的 `getType` 或 `isTypeMatch` 方法时，Spring 就会直接尝试创建一个产物 Bean 出来再获取实际类型，此时就可能会导致提前初始化。
第三点尤其需要注意，当我们调用容器的一些需要获取类型的方法时（比如 `ListableBeanFactory.getBeanNamesForType`），都会有提前初始化的风险。

### 循环依赖
`FactoryBean` 同样会有循环依赖问题，比如 `FactoryBean` 本身依赖另一个 Bean，而这个 Bean 又依赖从 `FactoryBean` 获得的产物。
这里 Spring 同样是通过缓存机制解决，不过与普通 Bean 不同，产物 Bean 由于不考虑代理也不考虑初始化问题，因此只使用了 `factoryBeanObjectCache` 这一级缓存来解决问题。

### 使用场景
`FactoryBean` 一般适用于两种场景：
* 创建无法通过正常的构造函数创建的对象：比较典型的是各种代理，比如 Dubbo 使用 ReferenceBean 创建 RPC 接口的代理对象，Mybatis 使用 MapperFactoryBean 来创建 Mapper 接口代理。
* 创建过程比较复杂的对象：比较典型的是 SqlSession， 比如 JPA 和 Myabtis 都选择通过一个 SqlSessionFactoryBean 来创建它。
这两个优点再概括一下，就是灵活，这里举几个例子：
* 使用 `FactoryBean` 创建对象可以不需要目标类一定有一个公开的构造方法，我们可以随意的通过任何方式来创建一个对象，比如动态代理，或者直接返回一个静态对象。
* 由于产物不需要被 Spring 管理，所以也不需要担心和其他 Bean 有什么依赖关系，不需要担心与 Spring 容器中的其他 Bean 共享某些组件导致问题。
* `FactoryBean` 本身可以用来作为第三方框架的集成切入点，比如 Mybatis 在创建 Mapper 代理类之前需要先初始化非常多的组件，然而通过 FactoryBean，它不需要将所有的组件交给 Spring 管理，而仅需要把这个过程使用 `FactoryBean` 封装一下就可以与 Spring 直接集成了。
简而言之，`FactoryBean` 是一个针对特定场景的解决方案，在实际的项目中，当我们比起直接使用构造方法，而更倾向使用工厂方法去创建一个 Bean 的时候，就可以考虑使用 FactoryBean 了。


## BeanFactory和FactoryBean的区别

BeanFactory 是 Spring 容器的顶级接口，它表示 Spring 框架中用于管理 Bean 生命周期的核心组件，被官方称为 IOC 容器。
它负责创建、配置和管理程序中所有的 Bean 实例。甚至 ApplicationContext 都是它的子接口，因此，从某种程度上来说，我们一般提到的 "Spring 容器" 其实指就是它。


FactoryBean 也是 Spring 提供的接口，实现了这个接口的 Bean 会被用于创建某种特定类型的对象。
它被广泛用于创建一些：
* 无法通过正常的构造函数创建的对象：比较典型的是各种代理，比如 Dubbo 使用 ReferenceBean 创建 RPC 接口的代理对象，Mybatis 使用 MapperFactoryBean 来创建 Mapper 接口代理。
* 创建过程比较复杂的对象：比较典型的是 SqlSession， 比如 JPA 和 Myabtis 都选择通过一个 SqlSessionFactoryBean 来创建它。
某种程度上来说，它和 BeanFactory 都能用于创建对象，不过它在使用上会更灵活一些。