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

```java
protected void invokeBeanFactoryPostProcessors(ConfigurableListableBeanFactory beanFactory) {
    PostProcessorRegistrationDelegate.invokeBeanFactoryPostProcessors(beanFactory, getBeanFactoryPostProcessors());

    // Detect a LoadTimeWeaver and prepare for weaving, if found in the meantime
    // (e.g. through an @Bean method registered by ConfigurationClassPostProcessor)
    if (beanFactory.getTempClassLoader() == null && beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
        beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
        beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
    }
}

public static void invokeBeanFactoryPostProcessors(
    ConfigurableListableBeanFactory beanFactory, List<BeanFactoryPostProcessor> beanFactoryPostProcessors) {

    // Invoke BeanDefinitionRegistryPostProcessors first, if any.
    Set<String> processedBeans = new HashSet<>();

    // 如果BeanFactory实现了BeanDefinitionRegistry接口
    if (beanFactory instanceof BeanDefinitionRegistry) {

        // 将后置处理器分为两类：
        // 1.普通的BeanFactoryPostProcessor;
        // 2.BeanFactoryPostProcessor的子类BeanDefinitionRegistryPostProcessor;
        BeanDefinitionRegistry registry = (BeanDefinitionRegistry) beanFactory;
        List<BeanFactoryPostProcessor> regularPostProcessors = new ArrayList<>();
        List<BeanDefinitionRegistryPostProcessor> registryProcessors = new ArrayList<>();
        for (BeanFactoryPostProcessor postProcessor : beanFactoryPostProcessors) {
            if (postProcessor instanceof BeanDefinitionRegistryPostProcessor) {
                BeanDefinitionRegistryPostProcessor registryProcessor =
                    (BeanDefinitionRegistryPostProcessor) postProcessor;
                // 若是BeanDefinitionRegistryPostProcessor，则先调用该类的postProcessBeanDefinitionRegistry方法
                registryProcessor.postProcessBeanDefinitionRegistry(registry);
                registryProcessors.add(registryProcessor);
            }
            else {
                regularPostProcessors.add(postProcessor);
            }
        }

        // Do not initialize FactoryBeans here: We need to leave all regular beans
        // uninitialized to let the bean factory post-processors apply to them!
        // Separate between BeanDefinitionRegistryPostProcessors that implement
        // PriorityOrdered, Ordered, and the rest.
        List<BeanDefinitionRegistryPostProcessor> currentRegistryProcessors = new ArrayList<>();

        // 先调用实现了PriorityOrdered接口的BeanDefinitionRegistryPostProcessors
        String[] postProcessorNames =
            beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
        for (String ppName : postProcessorNames) {
            if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
                currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
                processedBeans.add(ppName);
            }
        }
        sortPostProcessors(currentRegistryProcessors, beanFactory);
        registryProcessors.addAll(currentRegistryProcessors);
        invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);
        currentRegistryProcessors.clear();

        // 再调用实现了Ordered接口的BeanDefinitionRegistryPostProcessors
        postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
        for (String ppName : postProcessorNames) {
            if (!processedBeans.contains(ppName) && beanFactory.isTypeMatch(ppName, Ordered.class)) {
                currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
                processedBeans.add(ppName);
            }
        }
        sortPostProcessors(currentRegistryProcessors, beanFactory);
        registryProcessors.addAll(currentRegistryProcessors);
        invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);
        currentRegistryProcessors.clear();

        // 最后调用没实现PriorityOrdered或者Ordered接口的BeanDefinitionRegistryPostProcessors
        boolean reiterate = true;
        while (reiterate) {
            reiterate = false;
            postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
            for (String ppName : postProcessorNames) {
                if (!processedBeans.contains(ppName)) {
                    currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
                    processedBeans.add(ppName);
                    reiterate = true;
                }
            }
            sortPostProcessors(currentRegistryProcessors, beanFactory);
            registryProcessors.addAll(currentRegistryProcessors);
            invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);
            currentRegistryProcessors.clear();
        }

        // Now, invoke the postProcessBeanFactory callback of all processors handled so far.
        invokeBeanFactoryPostProcessors(registryProcessors, beanFactory);
        invokeBeanFactoryPostProcessors(regularPostProcessors, beanFactory);
    }

    // 如果BeanFactory没有实现BeanDefinitionRegistry接口
    else {
        // Invoke factory processors registered with the context instance.
        invokeBeanFactoryPostProcessors(beanFactoryPostProcessors, beanFactory);
    }

    // Do not initialize FactoryBeans here: We need to leave all regular beans
    // uninitialized to let the bean factory post-processors apply to them!
    String[] postProcessorNames =
        beanFactory.getBeanNamesForType(BeanFactoryPostProcessor.class, true, false);

    // 过滤掉已经调用过的处理器，然后把处理器分为三类：
    // 1.实现了PriorityOrdered接口的处理器;
    // 2.实现了Ordered接口的处理器;
    // 3.没有实现PriorityOrdered或Ordered接口的处理器;
    List<BeanFactoryPostProcessor> priorityOrderedPostProcessors = new ArrayList<>();
    List<String> orderedPostProcessorNames = new ArrayList<>();
    List<String> nonOrderedPostProcessorNames = new ArrayList<>();
    for (String ppName : postProcessorNames) {
        if (processedBeans.contains(ppName)) {
            // skip - already processed in first phase above
        }
        else if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
            priorityOrderedPostProcessors.add(beanFactory.getBean(ppName, BeanFactoryPostProcessor.class));
        }
        else if (beanFactory.isTypeMatch(ppName, Ordered.class)) {
            orderedPostProcessorNames.add(ppName);
        }
        else {
            nonOrderedPostProcessorNames.add(ppName);
        }
    }

     // 调用实现了PriorityOrdered接口的后置处理器
    sortPostProcessors(priorityOrderedPostProcessors, beanFactory);
    invokeBeanFactoryPostProcessors(priorityOrderedPostProcessors, beanFactory);

    // 调用实现了Ordered接口的后置处理器
    List<BeanFactoryPostProcessor> orderedPostProcessors = new ArrayList<>(orderedPostProcessorNames.size());
    for (String postProcessorName : orderedPostProcessorNames) {
        orderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));
    }
    sortPostProcessors(orderedPostProcessors, beanFactory);
    invokeBeanFactoryPostProcessors(orderedPostProcessors, beanFactory);

    // 调用没有实现PriorityOrdered或Ordered接口的后置处理器
    List<BeanFactoryPostProcessor> nonOrderedPostProcessors = new ArrayList<>(nonOrderedPostProcessorNames.size());
    for (String postProcessorName : nonOrderedPostProcessorNames) {
        nonOrderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));
    }
    invokeBeanFactoryPostProcessors(nonOrderedPostProcessors, beanFactory);

    // 清除元数据
    beanFactory.clearMetadataCache();
}
```
其中，我们需要重点关注一下 `BeanDefinitionRegistryPostProcessor` 这个后处理器，它实际上是 `BeanFactoryPostProcessor`的子接口，它运行容器启动以后动态的向 `BeanFactory` 注册额外的 `BeanDefinition` 。
我们非常熟悉的 `ConfigurationClassPostProcessor` 就实现了这个接口，带有 `@Bean` 注解的工厂方法对应的 `BeanDefinition` 就是在这个时候注册到容器的。

### 注册 BeanPostProcessor
当对 `BeanFactory` 应用后处理以后，此时所有必要的 BeanDefinition ———— 包括 `BeanPostProcessor` ，因为它们本质上也是 Bean ———— 都已经注册到容器。
此时则需要现将这些 `BeanPostProcessor` 创建出来，然后设置到 `BeanFactory` ：
```java
protected void registerBeanPostProcessors(ConfigurableListableBeanFactory beanFactory) {
    PostProcessorRegistrationDelegate.registerBeanPostProcessors(beanFactory, this);
}

public static void registerBeanPostProcessors(
    ConfigurableListableBeanFactory beanFactory, AbstractApplicationContext applicationContext) {

    String[] postProcessorNames = beanFactory.getBeanNamesForType(BeanPostProcessor.class, true, false);

    // Register BeanPostProcessorChecker that logs an info message when
    // a bean is created during BeanPostProcessor instantiation, i.e. when
    // a bean is not eligible for getting processed by all BeanPostProcessors.
    int beanProcessorTargetCount = beanFactory.getBeanPostProcessorCount() + 1 + postProcessorNames.length;
    beanFactory.addBeanPostProcessor(new BeanPostProcessorChecker(beanFactory, beanProcessorTargetCount));

    // 依然将后置处理器分为三类：
    // 1.实现了PriorityOrdered接口的处理器;
    // 2.实现了Ordered接口的处理器;
    // 3.没有实现PriorityOrdered或Ordered接口的处理器;
    List<BeanPostProcessor> priorityOrderedPostProcessors = new ArrayList<>();
    List<BeanPostProcessor> internalPostProcessors = new ArrayList<>();
    List<String> orderedPostProcessorNames = new ArrayList<>();
    List<String> nonOrderedPostProcessorNames = new ArrayList<>();
    for (String ppName : postProcessorNames) {
        if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
            BeanPostProcessor pp = beanFactory.getBean(ppName, BeanPostProcessor.class);
            priorityOrderedPostProcessors.add(pp);
            // 这里是用于框架内部使用的后置处理器
            if (pp instanceof MergedBeanDefinitionPostProcessor) {
                internalPostProcessors.add(pp);
            }
        }
        else if (beanFactory.isTypeMatch(ppName, Ordered.class)) {
            orderedPostProcessorNames.add(ppName);
        }
        else {
            nonOrderedPostProcessorNames.add(ppName);
        }
    }

    // 注册实现了PriorityOrdered接口的后置处理器
    sortPostProcessors(priorityOrderedPostProcessors, beanFactory);
    registerBeanPostProcessors(beanFactory, priorityOrderedPostProcessors);

    // 注册实现了Ordered接口的后置处理器
    List<BeanPostProcessor> orderedPostProcessors = new ArrayList<>(orderedPostProcessorNames.size());
    for (String ppName : orderedPostProcessorNames) {
        BeanPostProcessor pp = beanFactory.getBean(ppName, BeanPostProcessor.class);
        orderedPostProcessors.add(pp);
        if (pp instanceof MergedBeanDefinitionPostProcessor) {
            internalPostProcessors.add(pp);
        }
    }
    sortPostProcessors(orderedPostProcessors, beanFactory);
    registerBeanPostProcessors(beanFactory, orderedPostProcessors);

    // 注册没有实现PriorityOrdered或Ordered接口的后置处理器
    List<BeanPostProcessor> nonOrderedPostProcessors = new ArrayList<>(nonOrderedPostProcessorNames.size());
    for (String ppName : nonOrderedPostProcessorNames) {
        BeanPostProcessor pp = beanFactory.getBean(ppName, BeanPostProcessor.class);
        nonOrderedPostProcessors.add(pp);
        if (pp instanceof MergedBeanDefinitionPostProcessor) {
            internalPostProcessors.add(pp);
        }
    }
    registerBeanPostProcessors(beanFactory, nonOrderedPostProcessors);

    // 注解框架内部使用的后置处理器
    sortPostProcessors(internalPostProcessors, beanFactory);
    registerBeanPostProcessors(beanFactory, internalPostProcessors);

    // 重新注册ApplicationListenerDetector，保证该处理器总是位于处理器链的最后一位，从而总是在最后被执行
    // 该后置处理器用于支持spring的事件机制
    beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(applicationContext));
}
```
这里的排序逻辑与调用 `BeanFactoryPostProcessor` 是基本一致的，但是由于 `BeanPostProcessor` 的特殊性，我们需要注意一下几点：
* `BeanPostProcessor` 本身也是一个 Bean，因此会被其他 `BeanPostProcessor` 处理。
* 排序靠后的 `BeanPostProcessor` 会被排序靠前的 `BeanPostProcessor` 进行后处理，因为它更晚被创建。
关于上述两点，我们可以结合一个简单的例子去理解：
我们都知道，`ApplicationContextAware` 还有 @PostConstruct注解这些机制本身都是基于 BeanPostProcessor 实现的，而我们自定义的其他 `BeanPostProcessor` 却依然可以使用 `Aware` 接口或者 `@PostConstruct` 注解？
原因很简单，因为它们在 `ApplicationContextAwareProcessor` 之后创建，所以会被 `ApplicationContextAwareProcessor` 进行后处理。

## 初始化其他组件
这里的其他组件主要是消息源、事件广播器和监听器这几部分。

### 初始化消息源
这一步对应 `initMessageSource` 方法，消息源主要用于国际化相关的功能，这一块一般用的不多，因此简单了解一下即可：
```java
protected void initMessageSource() {
    ConfigurableListableBeanFactory beanFactory = getBeanFactory();
    if (beanFactory.containsLocalBean(MESSAGE_SOURCE_BEAN_NAME)) {
        this.messageSource = beanFactory.getBean(MESSAGE_SOURCE_BEAN_NAME, MessageSource.class);
        // Make MessageSource aware of parent MessageSource.
        if (this.parent != null && this.messageSource instanceof HierarchicalMessageSource) {
            HierarchicalMessageSource hms = (HierarchicalMessageSource) this.messageSource;
            if (hms.getParentMessageSource() == null) {
                // Only set parent context as parent MessageSource if no parent MessageSource
                // registered already.
                hms.setParentMessageSource(getInternalParentMessageSource());
            }
        }
        if (logger.isTraceEnabled()) {
            logger.trace("Using MessageSource [" + this.messageSource + "]");
        }
    }
    else {
        // Use empty MessageSource to be able to accept getMessage calls.
        DelegatingMessageSource dms = new DelegatingMessageSource();
        dms.setParentMessageSource(getInternalParentMessageSource());
        this.messageSource = dms;
        beanFactory.registerSingleton(MESSAGE_SOURCE_BEAN_NAME, this.messageSource);
        if (logger.isTraceEnabled()) {
            logger.trace("No '" + MESSAGE_SOURCE_BEAN_NAME + "' bean, using [" + this.messageSource + "]");
        }
    }
}
```

### 初始化广播器
这一步对应 `initApplicationEventMulticaster` 方法，没啥好说的，就是检查当前 `BeanFactory` 容器里面有没有名为 `applicationEventMulticaster` 且类型为 `ApplicationEventMulticaster` 的 Bean：
* 如果有，就把该广播器设置为当前容器的默认广播器。
* 如果没有，就创建一个 `SimpleApplicationEventMulticaster` ，然后将其注册到 `BeanFactory` 。

```java
public static final String APPLICATION_EVENT_MULTICASTER_BEAN_NAME = "applicationEventMulticaster";

protected void initApplicationEventMulticaster() {
    ConfigurableListableBeanFactory beanFactory = getBeanFactory();
    // 获取已有的广播器
    if (beanFactory.containsLocalBean(APPLICATION_EVENT_MULTICASTER_BEAN_NAME)) {
        this.applicationEventMulticaster =
                beanFactory.getBean(APPLICATION_EVENT_MULTICASTER_BEAN_NAME, ApplicationEventMulticaster.class);
        if (logger.isTraceEnabled()) {
            logger.trace("Using ApplicationEventMulticaster [" + this.applicationEventMulticaster + "]");
        }
    }
    else {
        // 如果没有广播器，就新建一个，然后注册到容器
        this.applicationEventMulticaster = new SimpleApplicationEventMulticaster(beanFactory);
        beanFactory.registerSingleton(APPLICATION_EVENT_MULTICASTER_BEAN_NAME, this.applicationEventMulticaster);
        if (logger.isTraceEnabled()) {
            logger.trace("No '" + APPLICATION_EVENT_MULTICASTER_BEAN_NAME + "' bean, using " +
                    "[" + this.applicationEventMulticaster.getClass().getSimpleName() + "]");
        }
    }
}
```

### 注册监听器
这一步对应 `registerListeners` 方法，简单的来说，就是获取当前 `BeanFactory` 中所有实现了 `ApplicationListener` 接口的 Bean，然后将其注册到广播器中：
```java
protected void registerListeners() {
    // 向事件广播器注册已经被注册的上下文中的监听器
    for (ApplicationListener<?> listener : getApplicationListeners()) {
        getApplicationEventMulticaster().addApplicationListener(listener);
    }

    // 向事件广播器注册指定的监听器，不过这里只注册BeanName，
    // 因为有些监听器Bean是由FactoryBean生产的，而在这里FactoryBean实际上还没被生成出来
    String[] listenerBeanNames = getBeanNamesForType(ApplicationListener.class, true, false);
    for (String listenerBeanName : listenerBeanNames) {
        getApplicationEventMulticaster().addApplicationListenerBean(listenerBeanName);
    }

    // 发布一些早期事件
    Set<ApplicationEvent> earlyEventsToProcess = this.earlyApplicationEvents;
    this.earlyApplicationEvents = null;
    if (!CollectionUtils.isEmpty(earlyEventsToProcess)) {
        for (ApplicationEvent earlyEvent : earlyEventsToProcess) {
            getApplicationEventMulticaster().multicastEvent(earlyEvent);
        }
    }
}
```

需要注意的是：
* 注册的是 `BeanName` 而不是直接注册 `Bean` ：为了尽可能的延迟 `Bean` 的加载，因此广播器只有等到要检索监听器的时候才会尝试根据 `beanName` 创建并获取监听器 `Bean` 。
* 只注册编程式监听器：这里只注册了直接实现 `ApplicationListener` 接口的编程式监听器。基于 `@EventListener` 注解的声明式监听器的注册时机更晚，需要等到实例化所有非单例 Bean 时才会完成注册。

### 预加载所有单例 Bean
这也是非常重要一步，在所有基本组件都完成初始化后，Spring 会在 `finishBeanFactoryInitialization` 这一步加载所有的非懒加载的单例 Bean：
```java
protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory beanFactory) {
    // 为BeanFactory设置ConversionService
    // 该接口为spring转换器体系的入口
    if (beanFactory.containsBean(CONVERSION_SERVICE_BEAN_NAME) &&
        beanFactory.isTypeMatch(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class)) {
        beanFactory.setConversionService(
            beanFactory.getBean(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class));
    }

    // 注册一个StringValueResolver，没有就从上下文的环境对象中获取
    // 该解析器用于解析配置文件中的一些占位符以及SpEL表达式
    if (!beanFactory.hasEmbeddedValueResolver()) {
        beanFactory.addEmbeddedValueResolver(strVal -> getEnvironment().resolvePlaceholders(strVal));
    }

    // 若存在AOP使用的支持类加载时织入切面逻辑的类加载器，则优先将该Bean初始化
    String[] weaverAwareNames = beanFactory.getBeanNamesForType(LoadTimeWeaverAware.class, false, false);
    for (String weaverAwareName : weaverAwareNames) {
        getBean(weaverAwareName);
    }

    // 由于类加载器已经初始化完成，所以可以停用临时的类加载器了
    beanFactory.setTempClassLoader(null);

    // 锁定当前工厂的配置
    beanFactory.freezeConfiguration();

    // 初始化剩余未初始化的非懒加载单例Bean
    beanFactory.preInstantiateSingletons();
}
```
这里我们重点关注 BeanFactory.preInstantiateSingletons() 方法，此处是实际上完成 Bean 初始化的代码：
```java
public void preInstantiateSingletons() throws BeansException {
    if (logger.isTraceEnabled()) {
        logger.trace("Pre-instantiating singletons in " + this);
    }

    // Iterate over a copy to allow for init methods which in turn register new bean definitions.
    // While this may not be part of the regular factory bootstrap, it does otherwise work fine.
    List<String> beanNames = new ArrayList<>(this.beanDefinitionNames);

    // 遍历beanName，若BeanName是可以实例化的非懒加载单例Bean，则将其实例化
    for (String beanName : beanNames) {
        RootBeanDefinition bd = getMergedLocalBeanDefinition(beanName);
        if (!bd.isAbstract() && bd.isSingleton() && !bd.isLazyInit()) {
			// 如果是FactoryBean
            if (isFactoryBean(beanName)) {
                Object bean = getBean(FACTORY_BEAN_PREFIX + beanName);
                if (bean instanceof FactoryBean) {
                    FactoryBean<?> factory = (FactoryBean<?>) bean;
                    boolean isEagerInit;
                    // 类型为SmartFactoryBean，则是否立刻实例化由SmartFactoryBean.isEagerInit()决定
                    if (System.getSecurityManager() != null && factory instanceof SmartFactoryBean) {
                        isEagerInit = AccessController.doPrivileged(
                            (PrivilegedAction<Boolean>) ((SmartFactoryBean<?>) factory)::isEagerInit,
                            getAccessControlContext());
                    }
                    else {
                    // 类型不为SmartFactoryBean，则不立刻实例化
                        isEagerInit = (factory instanceof SmartFactoryBean &&
                                       ((SmartFactoryBean<?>) factory).isEagerInit());
                    }
                    if (isEagerInit) {
                        getBean(beanName);
                    }
                }
            }
            else {
                // 实例化bean
                getBean(beanName);
            }
        }
    }

    // 获取所有实现了SmartInitializingSingleton接口的Bean，调用Bean初始化后回调afterSingletonsInstantiated
    for (String beanName : beanNames) {
        Object singletonInstance = getSingleton(beanName);
        if (singletonInstance instanceof SmartInitializingSingleton) {
            SmartInitializingSingleton smartSingleton = (SmartInitializingSingleton) singletonInstance;
            if (System.getSecurityManager() != null) {
                AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
                    smartSingleton.afterSingletonsInstantiated();
                    return null;
                }, getAccessControlContext());
            }
            else {
                smartSingleton.afterSingletonsInstantiated();
            }
        }
    }
}
```
简单的来说，这一步主要干了两件事：
* 判断是否单例 Bean：是就加载，不是就放弃。
* 判断是否单例的 FactorBean：
	* 如果不是，则放弃直接初始化。
	* 如果是，则检查是否是 `SmartFactoryBean，如果是就根据` `SmartFactoryBean.isEagerInit()` 判断是否要直接初始化，否则放弃初始化。
当初始化完毕后，Spring 还会检查这些 Bean 是否实现了 `SmartInitializingSingleton` 接口，如果是则调用该接口提供的回调函数。
至此， `BeanFactory` 中所有可以预先初始化的 Bean 都完成的初始化，我们已经可以通过 `BeanFactory` 正常的去获取 Bean 了。

> * 关于 FactoryBean，请参见：[什么是FactoryBean？](./beanFactory&factoryBean.html#factorybean)

## 完成刷新
在一切的末尾，Spring 将会调用 `finishRefresh` 方法真正的完成刷新：
```java
protected void finishRefresh() {
    // 清空资源缓存
    clearResourceCaches();

    // 初始化上下文的生命周期处理器
    initLifecycleProcessor();

    // 调用上下文的生命周期处理器
    getLifecycleProcessor().onRefresh();

    // 发布上下文刷新完毕事件
    publishEvent(new ContextRefreshedEvent(this));

    // 注册用于支持通过JMX管理spring的组件，这里不过多分析，
    // 关于JMX具体可以参考这篇文章：https://www.wdbyte.com/java/jmx.html#_3-2-%E8%B5%84%E6%BA%90%E4%BB%A3%E7%90%86-mbean-server
    LiveBeansView.registerApplicationContext(this);
}
```

在这个方法中，主要做了三件事：
* 清空所有资源缓存。
* 触发上下文的生命周期回调。
* 发布 ContextRefreshedEvent 事件。
此外，在 Web 环境中，Spring 还会在这时启动内置的 Web 容器。

### 清空上下文资源缓存
```java
public void clearResourceCaches() {
    this.resourceCaches.clear();
}
```

### 触发上下文的生命周期回调
```java
protected void initLifecycleProcessor() {
    ConfigurableListableBeanFactory beanFactory = getBeanFactory();
    // 若存在名为“lifecycleProcessor”的bean，则设置为生命周期处理器
    if (beanFactory.containsLocalBean(LIFECYCLE_PROCESSOR_BEAN_NAME)) {
        this.lifecycleProcessor =
            beanFactory.getBean(LIFECYCLE_PROCESSOR_BEAN_NAME, LifecycleProcessor.class);
        if (logger.isTraceEnabled()) {
            logger.trace("Using LifecycleProcessor [" + this.lifecycleProcessor + "]");
        }
    }
    // 若不存在名为“lifecycleProcessor”的bean，则创建一个DefaultLifecycleProcessor并设置为生命周期处理器
    else {
        DefaultLifecycleProcessor defaultProcessor = new DefaultLifecycleProcessor();
        defaultProcessor.setBeanFactory(beanFactory);
        this.lifecycleProcessor = defaultProcessor;
        beanFactory.registerSingleton(LIFECYCLE_PROCESSOR_BEAN_NAME, this.lifecycleProcessor);
        if (logger.isTraceEnabled()) {
            logger.trace("No '" + LIFECYCLE_PROCESSOR_BEAN_NAME + "' bean, using " +
                         "[" + this.lifecycleProcessor.getClass().getSimpleName() + "]");
        }
    }
}
```
在 `getLifecycleProcessor().onRefresh()` 这一步，将会获取上一步设置到上下文中的 `LifecycleProcessor` 然后调用：
```java

// AbstraceApplicationContext.getLifecycleProcessor()
LifecycleProcessor getLifecycleProcessor() throws IllegalStateException {
    if (this.lifecycleProcessor == null) {
        throw new IllegalStateException("LifecycleProcessor not initialized - " +
                                        "call 'refresh' before invoking lifecycle methods via the context: " + this);
    }
    return this.lifecycleProcessor;
}
```

这里我们以默认的生命周期处理器 `DefaultLifecycleProcessor` 为例：
```java
@Override
public void onRefresh() {
    startBeans(true);
    this.running = true;
}

private void startBeans(boolean autoStartupOnly) {
    // 获取所有实现了Lifecycle接口的Bean，并按阶段分组装到不同的LifecycleGroup里
    Map<String, Lifecycle> lifecycleBeans = getLifecycleBeans();
    Map<Integer, LifecycleGroup> phases = new HashMap<>();
    lifecycleBeans.forEach((beanName, bean) -> {
        // 同时满足下述条件的Bean不会被处理
        // 1.入参的autoStartupOnly为true
        // 2.bean实现了SmartLifecycle接口
        // 3.SmartLifecycle.isAutoStartup()方法返回false
        if (!autoStartupOnly || (bean instanceof SmartLifecycle && ((SmartLifecycle) bean).isAutoStartup())) {
            // 若实现了SmartLifecycle接口，则返回SmartLifecycle.getPhase()，否则默认返回0
            int phase = getPhase(bean); 
            LifecycleGroup group = phases.get(phase);
            if (group == null) {
                group = new LifecycleGroup(phase, this.timeoutPerShutdownPhase, lifecycleBeans, autoStartupOnly);
                phases.put(phase, group);
            }
            group.add(beanName, bean);
        }
    });
    
    // 按阶段从小到大排序，依次处理
    if (!phases.isEmpty()) {
        List<Integer> keys = new ArrayList<>(phases.keySet());
        Collections.sort(keys);
        for (Integer key : keys) {
            phases.get(key).start();
        }
    }
}
```
可以看到，这里针对 `SmartLifecycle` 接口的实现类做了很多特殊化的处理，默认情况下，如果 Bean：
* 没有实现 `SmartLifecycle` 接口，则直接进行处理。
* 实现了 `SmartLifecycle` 接口，则根据 `isAutoStartup` 方法决定是否要进行处理。
此外，在处理 Bean 的时候，还会**根据“Phase”按顺序从小到大排序**：
* 没实现 `SmartLifecycle` 接口，则最优先被处理。
* 实现了 `SmartLifecycle` 接口，根据 `getPhase` 的返回值从小到大依次处理。

### 发布 ContextRefreshedEvent 事件
这个操作其实也很简单，其实就是调用事件广播器推送一个 `ContextRefreshedEvent` 事件：
```java
public class ContextRefreshedEvent extends ApplicationContextEvent {
    public ContextRefreshedEvent(ApplicationContext source) {
        super(source);
    }
}
```

### 启动 WebServer
在 `SpringBoot` 中， `ServletWebServerApplicationContext` 和 `ReactiveWebServerApplicationContext` 都重写了 `finishRefresh` 方法，它们在这一步除了完成上述三个操作外，还会在这一步启动对应的 Web 服务器。
我们以最常见的 `ServletWebServerApplicationContext` 为例：
```java
@Override
protected void finishRefresh() {
    super.finishRefresh();
    WebServer webServer = startWebServer();
    if (webServer != null) {
        publishEvent(new ServletWebServerInitializedEvent(webServer, this));
    }
}

private WebServer startWebServer() {
    WebServer webServer = this.webServer;
    if (webServer != null) {
        webServer.start();
    }
    return webServer;
}
```
这里的 `WebServer` 实际上就是我们说的 SpringBoot 内嵌的 Web 容器，它的几个常见实现如下：
![pic](/spring/springboot-webserver-01.png)  

这里的 `WebServer` 实际上是通过 Spring 容器中的 `ServletWebServerFactory` 获取的，而 `ServletWebServerFactory` 则是通过对应是 starter 中的配置类引入的：
```java
protected ServletWebServerFactory getWebServerFactory() {
    // Use bean names so that we don't consider the hierarchy
    String[] beanNames = getBeanFactory().getBeanNamesForType(ServletWebServerFactory.class);
    if (beanNames.length == 0) {
        throw new ApplicationContextException("Unable to start ServletWebServerApplicationContext due to missing "
                + "ServletWebServerFactory bean.");
    }
    if (beanNames.length > 1) {
        throw new ApplicationContextException("Unable to start ServletWebServerApplicationContext due to multiple "
                + "ServletWebServerFactory beans : " + StringUtils.arrayToCommaDelimitedString(beanNames));
    }
    return getBeanFactory().getBean(beanNames[0], ServletWebServerFactory.class);
}
```
