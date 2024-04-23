# spring 容器的启动顺序
Spring 容器的启动过程实际上就是 `AbstractApplicationContext` 抽象类中 refresh 方法的执行过程，不考虑异常情况，一个容器正常启动的过程大致可以分为以下五个阶段：
1. 初始化上下文：对应 `prepareRefresh` 方法，用于完成重置上下文标志位，初始化配置文件，重置早期事件缓存等工作。
2. 初始化 BeanFactory：
	a. 创建实例：即为当前重新创建一个 `BeanFactory` ；
	b. 完成准备工作：为新 `BeanFactory` 实例设置一些默认配置，并添加一些必要的后处理器；
	c. 后处理：向工厂注册一些诸如 `Scope` 、表达式解析器、类型转换器等必要的基本组件；
	d. 使用后处理器：调用 `BeanFactoryPostProcessor` 对工厂进行后处理器，在这个阶段将会向 `BeanFactory` 注册必要的 `BeanDefinition` ，我们的配置类就在这个阶段生效；
	e. 注册 `BeanPostProcessor` ：从 `BeanFactory` 中创建并获取所有的 `BeanPostProcessor` ，然后将其注册到工厂中。
3. 初始化其他组件：
	a. 初始化消息源：尝试从容器中获取一个 `MessageSource` ，如果没有就建一个新的；
	b. 初始化广播器：尝试从容器中获取一个 `ApplicationEventMulticaster` ，如果没有就建一个新的；
	c. 注册消息监听器：将容器中所有实现了 `ApplicationListener` 接口的 Bean 都注册到广播器；
4. 预加载所有单例 Bean：加载容器中所有非懒加载的单例 Bean ，并触发 `SmartInitializingSingleton` 回调接口。
5. 完成刷新：
	a. 清空上下文资源缓存；
	b. 触发 `Lifecycle` 回调：从容器中获取所有实现了 `Lifecycle` 接口的 Bean，然后调用回调方法；
	c. 发布 `ContextRefreshedEvent` 事件；
	d. 启动内置的 Web 容器（ SpringBoot 应用）。

当我们提到 Spring 容器的启动过程，其是就是指 `AbstractApplicationContext` 的 `refresh` 方法的执行过程：
```java
public void refresh() throws BeansException, IllegalStateException {
    synchronized (this.startupShutdownMonitor) {
        
        // 预先准备资源
        prepareRefresh();
        
        // 创建 BeanFactory
        ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

        // 准备 BeanFactory，设置一些基本参数，并注册基本组件
        prepareBeanFactory(beanFactory);

        try {
            // 对于 BeanFactory 设置一些基本参数
            postProcessBeanFactory(beanFactory);

            // 调用 BeanFactoryPostProcessor
            invokeBeanFactoryPostProcessors(beanFactory);

            // 向 BeanFactory 注册 BeanPostProcessor
            registerBeanPostProcessors(beanFactory);

            // 初始化消息源，用于国际化
            initMessageSource();

            // 初始化消息广播器
            initApplicationEventMulticaster();

            // 空实现
            onRefresh();

            // 注册事件监听器
            registerListeners();

            // 初始化所有的非懒加载单例 Bean
            finishBeanFactoryInitialization(beanFactory);

            // 完成刷新，发送刷新完成事件
            finishRefresh();
        }

        catch (BeansException ex) {
            if (logger.isWarnEnabled()) {
                logger.warn("Exception encountered during context initialization - " +
                        "cancelling refresh attempt: " + ex);
            }

            // 销毁 Bean，并释放相关资源
            destroyBeans();

            // 将 active 设置为 false
            cancelRefresh(ex);

            // Propagate exception to caller.
            throw ex;
        }

        finally {
            // 释放一些缓存的资源
            resetCommonCaches();
        }
    }
}
```

忽略异常情况，总的来说，这一个方法主要的逻辑可以分为五部分：
1. 初始化上下文；
2. 初始化 BeanFactory；
3. 初始化其他上下文组件；
4. 预加载所有非懒加载的单例 Bean；
5. 收尾工作，释放资源，触发回调等等。

## 初始化上下文
这一步对应 `prepareRefresh` 方法，简单的来说，它做了三件事：
* 重置启动标志位：即重置 `closed` 和 `active` 属性。
* 准备配置文件：即通过 `initPropertySources` 加载配置文件，并且校验是否所有必要的配置都存在。
* 初始化事件配置：即重置所有早期事件监听器，并清空已发布的早期事件。
```java
protected void prepareRefresh() {
    // 重置 active 和 closed 标志位
    this.startupDate = System.currentTimeMillis();
    this.closed.set(false);
    this.active.set(true);

    if (logger.isDebugEnabled()) {
        if (logger.isTraceEnabled()) {
            logger.trace("Refreshing " + this);
        }
        else {
            logger.debug("Refreshing " + getDisplayName());
        }
    }

    // 加载配置文件
    initPropertySources();

    // 校验配置是否正确
    getEnvironment().validateRequiredProperties();

    // 初始化早期事件监听器
    if (this.earlyApplicationListeners == null) {
        this.earlyApplicationListeners = new LinkedHashSet<>(this.applicationListeners);
    }
    else {
        // Reset local application listeners to pre-refresh state.
        this.applicationListeners.clear();
        this.applicationListeners.addAll(this.earlyApplicationListeners);
    }

    // 初始化早期事件
    this.earlyApplicationEvents = new LinkedHashSet<>();
}
```
在这一步清空的是“早期事件”（ earlyApplicationEvent ）列表。所谓的 “早期事件”，实际上就是指容器启动完成之前就已经发布的事件。此时容器中的 Bean 都还没有被创建出来，因此没有任何监听器可以响应这些发布的事件，因此这些事件需要延迟到必要的监听器加载完毕后再发送。

## 初始化 BeanFactory
### 创建实例
对应 `obtainFreshBeanFactory` 方法，Spring 将会重置 `ApplicationContext` 中持有的 `ConfigurableListableBeanFactory` ：
```java
protected ConfigurableListableBeanFactory obtainFreshBeanFactory() {
    refreshBeanFactory();
    return getBeanFactory();
}

// 由 AbstractRefreshableApplicationContext 实现
@Override
protected final void refreshBeanFactory() throws BeansException {
    if (hasBeanFactory()) {
        // 销毁所有 Bean
        destroyBeans();
        // 关闭工厂
        closeBeanFactory();
    }
    try {
        // 创建一个新的工厂
        DefaultListableBeanFactory beanFactory = createBeanFactory();
        beanFactory.setSerializationId(getId());
        customizeBeanFactory(beanFactory);
        // 加载 BeanDefinition
        loadBeanDefinitions(beanFactory);
        this.beanFactory = beanFactory;
    }
    catch (IOException ex) {
        throw new ApplicationContextException("I/O error parsing bean definition source for " + getDisplayName(), ex);
    }
}
```
需要注意的地方有两点：
* `createBeanFactory` 这一步创建的对象基本都是 `DefaultListableBeanFactory` ，它是 `BeanFactory` 体系下的最下级实现类，几乎所有的 `ApplicationContext` 用的都是它。
* `loadBeanDefinitions` ：这一步将会加载配置文件中的 `BeanDefinition` ，默认会使用 `XmlBeanDefinitionReader` 读取 XML 文件，在高版本的 Spring 中基本不会用到了。

### 完成准备工作
这一步对应 `prepareBeanFactory` ，在这一步中，Spring 为将要使用的 `BeanFactory` 注册必要的基本组件，比如类加载器、表达式解析器，还有处理容器即 `Aware` 注解的后处理器 `ApplicationContextAwareProcessor` 等等......
```java
protected void prepareBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    // Tell the internal bean factory to use the context's class loader etc.
    beanFactory.setBeanClassLoader(getClassLoader());
    beanFactory.setBeanExpressionResolver(new StandardBeanExpressionResolver(beanFactory.getBeanClassLoader()));
    beanFactory.addPropertyEditorRegistrar(new ResourceEditorRegistrar(this, getEnvironment()));

    // Configure the bean factory with context callbacks.
    beanFactory.addBeanPostProcessor(new ApplicationContextAwareProcessor(this));
    beanFactory.ignoreDependencyInterface(EnvironmentAware.class);
    beanFactory.ignoreDependencyInterface(EmbeddedValueResolverAware.class);
    beanFactory.ignoreDependencyInterface(ResourceLoaderAware.class);
    beanFactory.ignoreDependencyInterface(ApplicationEventPublisherAware.class);
    beanFactory.ignoreDependencyInterface(MessageSourceAware.class);
    beanFactory.ignoreDependencyInterface(ApplicationContextAware.class);

	// 注册无需创建的特殊 Bean，依赖注入的时候会直接拿到当前这里指定的对象
    beanFactory.registerResolvableDependency(BeanFactory.class, beanFactory);
    beanFactory.registerResolvableDependency(ResourceLoader.class, this);
    beanFactory.registerResolvableDependency(ApplicationEventPublisher.class, this);
    beanFactory.registerResolvableDependency(ApplicationContext.class, this);

	// 注册事件监听器检查器
    // Register early post-processor for detecting inner beans as ApplicationListeners.
    beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(this));

    // Detect a LoadTimeWeaver and prepare for weaving, if found.
    if (beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
        beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
        // Set a temporary ClassLoader for type matching.
        beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
    }

    // Register default environment beans.
    if (!beanFactory.containsLocalBean(ENVIRONMENT_BEAN_NAME)) {
        beanFactory.registerSingleton(ENVIRONMENT_BEAN_NAME, getEnvironment());
    }
    if (!beanFactory.containsLocalBean(SYSTEM_PROPERTIES_BEAN_NAME)) {
        beanFactory.registerSingleton(SYSTEM_PROPERTIES_BEAN_NAME, getEnvironment().getSystemProperties());
    }
    if (!beanFactory.containsLocalBean(SYSTEM_ENVIRONMENT_BEAN_NAME)) {
        beanFactory.registerSingleton(SYSTEM_ENVIRONMENT_BEAN_NAME, getEnvironment().getSystemEnvironment());
    }
}
```

### 后处理
这一步对应 `postProcessBeanFactory` 方法，在 `AbstractApplicationContext` 中实际上该方法是一个空方法，在 `GenericWebApplicationContext` 等子类才有实现：
```java
// GenericWebApplicationContext
@Override
protected void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    beanFactory.addBeanPostProcessor(new ServletContextAwareProcessor(this.servletContext));
    beanFactory.ignoreDependencyInterface(ServletContextAware.class);

    WebApplicationContextUtils.registerWebApplicationScopes(beanFactory, this.servletContext);
    WebApplicationContextUtils.registerEnvironmentBeans(beanFactory, this.servletContext);
}

// ServletWebServerApplicationContext
@Override
protected void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    beanFactory.addBeanPostProcessor(new WebApplicationContextServletContextAwareProcessor(this));
    beanFactory.ignoreDependencyInterface(ServletContextAware.class);
    registerWebApplicationScopes();
}
```

总的来看，Web 环境下使用的上下文基本都实现了这个方法，在这一步，它们做了以下几件事：
* 注册 Web 环境下的几个 scope： request、session 和 application。
* 设置 Web 环境下的特殊 Bean：ServletRequest、ServletResponse、HeepSession、WebRequest。

### 应用 BeanFactoryPostProcessor
`invokeBeanFactoryPostProcessors` 这一步就是重头戏了，在这一个方法中，Spring 将会加载所有的 `BeanFactorPostProcessor` ，然后使用它对 `BeanFactory` 进行后处理。
由于这一段代码非常的长，所以这里直接先放结论：
* 不同类型处理器的调用顺序：
	* `BeanDefinitionRegistryPostProcessor` 先调用，它通常用于注册额外的 `BeanDefinition。`
	* `BeanFactoryPostProcessor` 后调用。
* 同类型处理器的调用顺序：
	* 先调用实现了 `PriorityOrdered` 接口的 `BeanDefinitionRegistryPostProcessor` ；
	* 再调用实现了 Ordered 接口的 `BeanDefinitionRegistryPostProcessor` ；
 	* 最后调用没有实现上述两接口的 `BeanDefinitionRegistryPostProcessor` 。