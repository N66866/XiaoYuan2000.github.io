# 抽象的SpringUtil
## 难理解之Hutool-SpringUtil注入失败
在项目中直接调用Hutool包里的SpringUtil，使用@Resource方式注入Bean，调用时抛**SpringUtil空指针异常**。然后笔者把Hutool-SpringUtil的代码原封不动的复制出来新建一个文件保存，嘿您猜怎么着？注入成功了！太抽象了
* 猜测原因：SpringBoot项目没扫描到Hutool包下的Bean。但是当时忘记验证了，只好作罢。
## 难理解之SpringUtil调用空指针
SpringUtil implements ApplicationContextAware 比 @PostConstruct 后初始化，导致@PostConstruct的初始化时调用SpringUtil报空指针异常。
* 嘿您猜怎么着！上一章节刚解决的问题，过了一天他就出现本章的调用**SpringUtil.getBean()中的applicationContext空指针异常**，前一天还好，隔天报错！一开电脑就错，十分抽象
* 猜测原因：@PostConstruct 比 ApplicationContextAware 先执行。
* 1. 采用解决方法：@DependOn ，让@PostConstruct方法依赖于SpringUtil，您猜怎么着？嘿！不行，还是报错。十分抽象
* 2. 采用解决方法：@Order 让SpringUtil先初始化一步。嘿！您猜怎么着？还是不行，依然报错，十分抽象。
* 3. 采用解决方法：@Resource 把SpringUtil先行注入进包含@PostConstruct的类中。嘿！您猜怎么着！这次行了，太抽象了。
* TODO： 各种百度和问AI没得出原因，知识不够暂且作罢，改日拿我的大知识狠狠地蹂躏小小Spring