# ThreadLocal
## ThreadLocal 分析
```ThreadLocal```，作者：```Josh Bloch``` and ```Doug Lea```，两位大神👍

如果仅是日常业务开发来看，这是一个比较冷门的类，使用频率并不高。并且它提供的方法也非常简单，一个功能只是潦潦数行代码。但，如果深挖实现部分的源码，就会发现事情并不那么简单。这里涉及了太多的知识点，包括；数据结构、拉链存储、斐波那契散列、神奇的0x61c88647、弱引用Reference、过期key探测清理和启发式清理等等。

接下来，我们就逐步学习这些盲区知识。
## 使用场景
### 1.1 SimpleDateFormat
```java
private SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

public void seckillSku(){
    String dateStr = f.format(new Date());
    // 业务流程
}
```
你写过这样的代码吗？如果还在这么写，那就已经犯了一个线程安全的错误。```SimpleDateFormat```，并不是一个线程安全的类。
#### 线程不安全验证
```java
private static SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

public static void main(String[] args) {
    while (true) {
        new Thread(() -> {
            String dateStr = f.format(new Date());
            try {
                Date parseDate = f.parse(dateStr);
                String dateStrCheck = f.format(parseDate);
                boolean equals = dateStr.equals(dateStrCheck);
                if (!equals) {
                    System.out.println(equals + " " + dateStr + " " + dateStrCheck);
                } else {
                    System.out.println(equals);
                }
            } catch (ParseException e) {
                System.out.println(e.getMessage());
            }
        }).start();
    }
}
```
这是一个多线程下``` SimpleDateFormat ```的验证代码。当 ```equals``` 为false 时，证明线程不安全。运行结果如下:
```java
true
true
false 2020-09-23 11:40:42 2230-09-23 11:40:42
true
true
false 2020-09-23 11:40:42 2020-09-23 11:40:00
false 2020-09-23 11:40:42 2020-09-23 11:40:00
false 2020-09-23 11:40:00 2020-09-23 11:40:42
true
false 2020-09-23 11:40:42 2020-08-31 11:40:42
true
```
SimpleDateFormat 的线程不安全性主要源于其内部维护的日期格式化模式和相关的状态信息。SimpleDateFormat 对象在格式化和解析日期时需要维护一些内部状态，例如日期格式模式、解析器和格式化器等。如果多个线程同时访问同一个 SimpleDateFormat 实例并尝试进行格式化或解析操作，这些内部状态可能会被并发修改，导致不一致的结果、异常或线程间的竞争条件。
#### 使用 ThreadLocal 优化
为了线程安全最直接的方式，就是每次调用都直接 new SimpleDateFormat。但这样的方式终究不是最好的，所以我们使用 ThreadLocal ，来优化这段代码。
```java
private static ThreadLocal<SimpleDateFormat> threadLocal = ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"));
public static void main(String[] args) {
    while (true) {
        new Thread(() -> {
            String dateStr = threadLocal.get().format(new Date());
            try {
                Date parseDate = threadLocal.get().parse(dateStr);
                String dateStrCheck = threadLocal.get().format(parseDate);
                boolean equals = dateStr.equals(dateStrCheck);
                if (!equals) {
                    System.out.println(equals + " " + dateStr + " " + dateStrCheck);
                } else {
                    System.out.println(equals);
                }
            } catch (ParseException e) {
                System.out.println(e.getMessage());
            }
        }).start();
    }
}
```
如上我们把 SimpleDateFormat ，放到 ThreadLocal 中进行使用，即不需要重复new对象，也避免了线程不安全问题。测试结果如下；
```java
true
true
true
true
true
true
true
```
### 1.2 链路追踪
#### 追踪代码
```java
public class TrackContext {

    private static final ThreadLocal<String> trackLocal = new ThreadLocal<>();

    public static void clear(){
        trackLocal.remove();
    }

    public static String getLinkId(){
        return trackLocal.get();
    }

    public static void setLinkId(String linkId){
        trackLocal.set(linkId);
    }

}
```

```java
@Advice.OnMethodEnter()
public static void enter(@Advice.Origin("#t") String className, @Advice.Origin("#m") String methodName) {
    Span currentSpan = TrackManager.getCurrentSpan();
    if (null == currentSpan) {
        String linkId = UUID.randomUUID().toString();
        TrackContext.setLinkId(linkId);
    }
    TrackManager.createEntrySpan();
}

@Advice.OnMethodExit()
public static void exit(@Advice.Origin("#t") String className, @Advice.Origin("#m") String methodName) {
    Span exitSpan = TrackManager.getExitSpan();
    if (null == exitSpan) return;
    System.out.println("链路追踪(MQ)：" + exitSpan.getLinkId() + " " + className + "." + methodName + " 耗时：" + (System.currentTimeMillis() - exitSpan.getEnterTime().getTime()) + "ms");
}
```
* 以上这部分就是非入侵监控中，链路追踪的过程。
* 这也只是其中一个实现方式，字节码插桩使用的是 ```byte-buddy```，其实还是使用，```ASM``` 或者 ```Javassist```。

## 数据结构
了解一个功能前，先了解它的数据结构。这就相当于先看看它的地基，有了这个根本也就好往后理解了。以下是 ```ThreadLocal``` 的简单使用以及部分源码。
```java
new ThreadLocal<String>().set("NULL");
```
```java
private void set(ThreadLocal<?> key, Object value) {
   
    Entry[] tab = table; //以前的优化方式，不用每次使用变量时从全局读取。 但是现在已经jvm优化过了，这不这样写都可以。
    int len = tab.length;
    int i = key.threadLocalHashCode & (len-1);
    
 	for (Entry e = tab[i];
                 e != null;
                 e = tab[i = nextIndex(i, len)]) {
    ...
}
```
从这部分源码中可以看到，```ThreadLocal``` 底层采用的是数组结构存储数据，同时还有哈希值计算下标，这说明它是一个散列表的数组结构，演示如下图：
![pic](/java/threadlocal/interview-13-02.png)
* 如上图是 ThreadLocal 存放数据的底层数据结构，包括知识点如下；
1. 它是一个数组结构。
2. Entry，其实它是一个弱引用实现，```static class Entry extends WeakReference<ThreadLocal<?>>```。这说明只要没用强引用存在，发生GC时就会被垃圾回收。
    * 此外，值得注意的是，Entry继承了WeakReference并且将 ThreadLocal 作为弱引用，这意味着当外界对ThreadLocal 的强引用消失后，即使该 Entry 依然在槽中存在，但是它的 Key 却已经变为了 null，这种键值对实际上是已经失效的。[点此查看对应拓展知识](#拓展知识) 
3. 数据元素采用哈希散列方式进行存储，不过这里的散列使用的是 斐波那契（Fibonacci）散列法，后面会具体分析。
4. 另外由于这里不同于HashMap的数据结构，发生哈希碰撞不会存成链表或红黑树，而是使用开放寻址进行存储。也就是同一个下标位置发生冲突时，则+1向后寻址，直到找到空位置或垃圾回收位置进行存储。

---
## 散列算法
既然 ```ThreadLocal``` 是基于数组结构的开放寻址方式存储，那就一定会有哈希的计算。但我们翻阅源码后，发现这个哈希计算与``` HashMap ```中的散列求数组下标计算的哈希方式不一样。
### 神秘的数字 0x61c88647
当我们查看 ```ThreadLocal``` 执行设置元素时，有这么一段计算哈希值的代码:
```java
private static final int HASH_INCREMENT = 0x61c88647;

private static int nextHashCode() {
    return nextHashCode.getAndAdd(HASH_INCREMENT);
}
```
看到这里你一定会有这样的疑问，这是什么方式计算哈希？这个数字怎么来的？
讲到这里，其实计算哈希的方式，绝不止是我们平常看到 String 获取哈希值的一种方式，还包括；除法散列法、平方散列法、斐波那契（Fibonacci）散列法、随机数法等。
而``` ThreadLocal ```使用的就是 ```斐波那契（Fibonacci）散列法``` + 拉链法存储数据到数组结构中。之所以使用斐波那契数列，是为了让数据更加散列，减少哈希碰撞。具体来自数学公式的计算求值，公式：```f(k) = ((k * 2654435769) >> X) << Y```对于常见的32位整数而言，也就是 ```f(k) = (k * 2654435769) >> 28```
* 其中，常量 ```2654435769``` 是一个特殊的常数，它是黄金比例（φ）的倒数乘以 2^32。在哈希函数中使用这个常数可以帮助减少冲突并提高哈希函数的散列性能。
* 常数 0x61c88647，它是通过将黄金比例的近似值(0.618...)乘以 2^32（因为 Java 中的整数是 32 位）并取整得到的。```0x61c88647 = (φ * 2^32) & 0xFFFFFFFF``` 其中，& 0xFFFFFFFF 是对结果进行截断，只保留低 32 位。
* 衆所周知，黄金分割点是，(√5 - 1) / 2，取10位近似 0.6180339887。
* 之后用 2 ^ 32 * 0.6180339887，得到的结果是：-1640531527，也就是 16 进制的0x61c88647。这个数呢也就是这么来的
### 验证散列
既然，Josh Bloch 和 Doug Lea，两位老爷子选择使用斐波那契数列，计算哈希值。那一定有它的过人之处，也就是能更好的散列，减少哈希碰撞。
接下来我们按照源码中获取哈希值和计算下标的方式，把这部分代码提出出来做验证。
```java
private static AtomicInteger nextHashCode = new AtomicInteger();
 
private static final int HASH_INCREMENT = 0x61c88647;

// 计算哈希
private static int nextHashCode() {
    return nextHashCode.getAndAdd(HASH_INCREMENT);
}

// 获取下标
int i = key.threadLocalHashCode & (len-1);
```
如上，源码部分采用的是 ```AtomicInteger```，原子方法计算下标。我们不需要保证线程安全，只需要简单实现即可。另外 ThreadLocal 初始化数组长度是16，我们也初始化这个长度。
```java
//单元测试
@Test
public void test_idx() {
    int hashCode = 0;
    for (int i = 0; i < 16; i++) {
        hashCode = i * HASH_INCREMENT + HASH_INCREMENT;
        int idx = hashCode & 15;
        System.out.println("斐波那契散列：" + idx + " 普通散列：" + (String.valueOf(i).hashCode() & 15));
    }
}
```
```java
//测试结果
斐波那契散列：7 普通散列：0
斐波那契散列：14 普通散列：1
斐波那契散列：5 普通散列：2
斐波那契散列：12 普通散列：3
斐波那契散列：3 普通散列：4
斐波那契散列：10 普通散列：5
斐波那契散列：1 普通散列：6
斐波那契散列：8 普通散列：7
斐波那契散列：15 普通散列：8
斐波那契散列：6 普通散列：9
斐波那契散列：13 普通散列：15
斐波那契散列：4 普通散列：0
斐波那契散列：11 普通散列：1
斐波那契散列：2 普通散列：2
斐波那契散列：9 普通散列：3
斐波那契散列：0 普通散列：4

Process finished with exit code 0

```
**发现没？，斐波那契散列的非常均匀，普通散列到15个以后已经开发生产碰撞。这也就是斐波那契散列的魅力，减少碰撞也就可以让数据存储的更加分散，获取数据的时间复杂度基本保持在O(1)。**
## 源码解读
### 初始化
```new ThreadLocal<>()```
初始化的过程也很简单，可以按照自己需要的泛型进行设置。但在 ThreadLocal 的源码中有一点非常重要，就是获取 ```threadLocal``` 的哈希值的获取，```threadLocalHashCode```
```java
private final int threadLocalHashCode = nextHashCode();

/**
 * Returns the next hash code.
 */
private static int nextHashCode() {
    return nextHashCode.getAndAdd(HASH_INCREMENT);
}
```
如源码中，只要实例化一个 ThreadLocal ，就会获取一个相应的哈希值，则例我们做一个例子。
```java
@Test
public void test_threadLocalHashCode() throws Exception {
    for (int i = 0; i < 5; i++) {
        ThreadLocal<Object> objectThreadLocal = new ThreadLocal<>();
        Field threadLocalHashCode = objectThreadLocal.getClass().getDeclaredField("threadLocalHashCode");
        threadLocalHashCode.setAccessible(true);
        System.out.println("objectThreadLocal：" + threadLocalHashCode.get(objectThreadLocal));
    }
}
```
因为 threadLocalHashCode ，是一个私有属性，所以我们实例化后通过上面的方式进行获取哈希值。
```java
objectThreadLocal：-1401181199
objectThreadLocal：239350328
objectThreadLocal：1879881855
objectThreadLocal：-774553914
objectThreadLocal：865977613

Process finished with exit code 0
```
这个值的获取，也就是计算``` ThreadLocalMap```，存储数据时，```ThreadLocal``` 的数组下标。只要是这同一个对象，在```set、get```时，就可以设置和获取对应的值。
### 设置元素
#### 流程图解
```new ThreadLocal<>().set("NULL");```
设置元素的方法，也就这么一句代码。但设置元素的流程却涉及的比较多，在详细分析代码前，我们先来看一张设置元素的流程图，从图中先了解不同情况的流程之后再对比着学习源码。流程图如下；
![pic](/java/threadlocal/interview-13-03.png)
乍一看可能感觉有点晕，我们从左往右看，分别有如下知识点:
0. 中间是 ThreadLocal 的数组结构，之后在设置元素时分为四种不同的情况，另外元素的插入是通过斐波那契散列计算下标值，进行存放的。
1. 情况1，待插入的下标，是空位置直接插入。
2. 情况2，待插入的下标，不为空，key 相同，直接更新
3. 情况3，待插入的下标，不为空，key 不相同，开放寻址
4. 情况4，不为空，key 不相同，碰到过期key。其实情况4，遇到的是弱引用发生GC时，产生的情况。碰到这种情况，ThreadLocal 会进行探测清理过期key，这部分清理内容后续讲解。
#### 源码分析
```java
private void set(ThreadLocal<?> key, Object value) {
    Entry[] tab = table;
    int len = tab.length;
    int i = key.threadLocalHashCode & (len-1);
    for (Entry e = tab[i]; e != null; e = tab[i = nextIndex(i, len)]) 
    {
        ThreadLocal<?> k = e.get();
        if (k == key) {
            e.value = value;
            return;
        }
        if (k == null) {
            replaceStaleEntry(key, value, i);
            return;
        }
    }
    tab[i] = new Entry(key, value);
    int sz = ++size;
    if (!cleanSomeSlots(i, sz) && sz >= threshold)
        rehash();
}
```
在有了上面的图解流程，再看代码部分就比较容易理解了，与之对应的内容包括，如下；

```key.threadLocalHashCode & (len-1);```，斐波那契散列，计算数组下标。
Entry，是一个弱引用对象的实现类，```static class Entry extends WeakReference<ThreadLocal<?>>```，所以在没有外部强引用下，会发生GC，删除key。
for循环判断元素是否存在，当前下标不存在元素时，直接设置元素 tab[i] = new Entry(key, value);。
如果元素存在，则会判断是否key值相等 if (k == key)，相等则更新值。
如果不相等，就到了我们的 ```replaceStaleEntry```，也就是上图说到的探测式清理过期元素。
综上，就是元素存放的全部过程，整体结构的设计方式非常赞👍，极大的利用了散列效果，也把弱引用使用的非常6！
### 扩容机制
####  扩容条件
只要使用到数组结构，就一定会有扩容
```java
if (!cleanSomeSlots(i, sz) && sz >= threshold)
    rehash();
```
在我们阅读设置元素时，有以上这么一块代码，判断是否扩容。
1. 首先，进行启发式清理*cleanSomeSlots*，把过期元素清理掉，看空间是否足够
2. 之后，判断sz >= threshold，其中 threshold = len * 2 / 3，也就是说数组中天填充的元素，大于 len * 2 / 3，就需要扩容了。
3. 最后，就是我们要分析的重点，rehash();，扩容重新计算元素位置。
####  源码分析
**探测式清理和校验**
```java
private void rehash() {
    expungeStaleEntries();
    
    // Use lower threshold for doubling to avoid hysteresis
    if (size >= threshold - threshold / 4)
        resize();
}

private void expungeStaleEntries() {
    Entry[] tab = table;
    int len = tab.length;
    for (int j = 0; j < len; j++) {
        Entry e = tab[j];
        if (e != null && e.get() == null)
            expungeStaleEntry(j);
    }
}
/**
 *  以下这段是简化后的伪代码，完整代码在下文讲解
 *  expungeStaleEntry() 方法的主要作用是清理废弃的 ThreadLocal 实例的条目。它在 ThreadLocalMap 中查找指定索引位置的条目，并将其设为 null，表示它已经废弃。
 *	随后，方法会遍历剩余的条目，对于非空的条目，如果关联的 ThreadLocal 实例已经被垃圾回收（即 key == null），则会调用 entry.expungeStaleEntry() 方法进一步清理废弃的条目。
 *	对于仍然有效的条目，方法会重新计算哈希码，并将条目移动到正确的索引位置，以保持 ThreadLocalMap 中条目的连续性。
 * 
 * */
private void expungeStaleEntry(int staleSlot) {
    // 获取当前线程的 ThreadLocalMap
    ThreadLocalMap table = getMap(Thread.currentThread());

    // 获取 ThreadLocalMap 的条目数组
    Entry[] entries = table.getEntryArray();

    // 获取条目数组的长度
    int len = entries.length;

    // 移除指定索引位置的条目
    entries[staleSlot] = null;

    // 重新计算哈希码并重新插入条目
    for (int i = staleSlot + 1; i < len; i++) {
        Entry entry = entries[i];
        if (entry != null) {
            ThreadLocal<?> key = entry.get();
            if (key == null) {
                // 清理废弃的条目
                entry.expungeStaleEntry();
            } else {
                int index = key.threadLocalHashCode & (len - 1);
                if (index != i) {
                    // 移动条目到正确的索引位置(即将之前下标碰撞后开放地址法排到后面的元素移植正确的位置)
                    entries[i] = null;
                    while (entries[index] != null) {
                        index = nextIndex(index, len);
                    }
                    entries[index] = entry;
                }
            }
        }
    }
}
```
* 这部分是主要是探测式清理过期元素，以及判断清理后是否满足扩容条件，size >= threshold * 3/4
* 满足后执行扩容操作，其实扩容完的核心操作就是重新计算哈希值，把元素填充到新的数组中。

**resize() 扩容**
```java
private void resize() {
    Entry[] oldTab = table;
    int oldLen = oldTab.length;
    int newLen = oldLen * 2;
    Entry[] newTab = new Entry[newLen];
    int count = 0;
    for (int j = 0; j < oldLen; ++j) {
        Entry e = oldTab[j];
        if (e != null) {
            ThreadLocal<?> k = e.get();
            if (k == null) {
                e.value = null; // Help the GC
            } else {
                int h = k.threadLocalHashCode & (newLen - 1);
                while (newTab[h] != null)
                    h = nextIndex(h, newLen);
                newTab[h] = e;
                count++;
            }
        }
    }
    setThreshold(newLen);
    size = count;
    table = newTab;
}
```
以上，代码就是扩容的整体操作，具体包括如下步骤；
1. 首先把数组长度扩容到原来的2倍，oldLen * 2，实例化新数组。
2. 遍历for，所有的旧数组中的元素，重新放到新数组中。
3. 在放置数组的过程中，如果发生哈希碰撞，则链式法顺延。
4. 同时这还有检测key值的操作 if (k == null)，方便GC。
### 获取元素
```new ThreadLocal<>().get();```
同样获取元素也就这么一句代码，如果没有分析源码之前，你能考虑到它在不同的数据结构下，获取元素时候都做了什么操作吗。我们先来看下图，分为如下种情况:
![pic](/java/threadlocal/interview-13-05.png)
按照不同的数据元素存储情况，基本包括如下情况；
1. 直接定位到，没有哈希冲突，直接返回元素即可。
2. 没有直接定位到了，key不同，需要拉链式寻找。
3. 没有直接定位到了，key不同，拉链式寻找，遇到GC清理元素，需要探测式清理，再寻找元素。
#### 源码分析
```java
private Entry getEntry(ThreadLocal<?> key) {
    int i = key.threadLocalHashCode & (table.length - 1);
    Entry e = table[i];
    if (e != null && e.get() == key)
        return e;
    else
        return getEntryAfterMiss(key, i, e);
}

private Entry getEntryAfterMiss(ThreadLocal<?> key, int i, Entry e) {
    Entry[] tab = table;
    int len = tab.length;
    while (e != null) {
        ThreadLocal<?> k = e.get();
        if (k == key)
            return e;
        //探测式清理
        if (k == null)
            expungeStaleEntry(i);
        else
            i = nextIndex(i, len);
        e = tab[i];
    }
    return null;
}
```
好了，这部分就是获取元素的源码部分，和我们图中列举的情况是一致的。```expungeStaleEntry```，是发现有``` key == null```时，进行清理过期元素，并把后续位置的元素，前移。

### 元素清理
#### 探测式清理[expungeStaleEntry]  
探测式清理，是以当前遇到的 GC 元素开始，向后不断的清理。直到遇到 null 为止，才停止 rehash 计算```Rehash until we encounter null```
```java
private int expungeStaleEntry(int staleSlot) {
    Entry[] tab = table;
    int len = tab.length;
    // expunge entry at staleSlot
    tab[staleSlot].value = null;
    tab[staleSlot] = null;
    size--;
    // Rehash until we encounter null
    Entry e;
    int i;
    for (i = nextIndex(staleSlot, len);
         (e = tab[i]) != null;
         i = nextIndex(i, len)) {
        ThreadLocal<?> k = e.get();
        if (k == null) {
            e.value = null;
            tab[i] = null;
            size--;
        } else {
            int h = k.threadLocalHashCode & (len - 1);
            if (h != i) {
                tab[i] = null;
                // Unlike Knuth 6.4 Algorithm R, we must scan until
                // null because multiple entries could have been stale.
                while (tab[h] != null)
                    h = nextIndex(h, len);
                tab[h] = e;
            }
        }
    }
    return i;
}
```
以上，探测式清理在获取元素中使用流程： new ThreadLocal<>().get() -> map.getEntry(this) -> getEntryAfterMiss(key, i, e) -> expungeStaleEntry(i)
即 获取元素 -> 调用getEntry方法 ->没找到就调用getEntryAfterMiss -> 然后就探测式清理
####  启发式清理[cleanSomeSlots]
```java
Heuristically scan some cells looking for stale entries.
This is invoked when either a new element is added, or
another stale one has been expunged. It performs a
logarithmic number of scans, as a balance between no
scanning (fast but retains garbage) and a number of scans
proportional to number of elements, that would find all
garbage but would cause some insertions to take O(n) time.
/**
 * 
 * 启发式清理，有这么一段注释，大概意思是；试探的扫描一些单元格，寻找过期元素，也就是被垃圾回收的元素。
 * 当添加新元素或删除另一个过时元素时，将调用此函数。
 * 它执行对数扫描次数，作为不扫描（快速但保留垃圾）和与元素数量成比例的扫描次数之间的平衡，这将找到所有垃圾，但会导致一些插入花费O（n）时间。
 * 
 * */
```
```java
private boolean cleanSomeSlots(int i, int n) {
    boolean removed = false;
    Entry[] tab = table;
    int len = tab.length;
    do {
        i = nextIndex(i, len);
        Entry e = tab[i];
        if (e != null && e.get() == null) {
            n = len;
            removed = true;
            i = expungeStaleEntry(i);
        }
    } while ( (n >>>= 1) != 0);
    return removed;
}
```

### 总结
* 写到这算是把 ThreadLocal 知识点的一角分析完了，在 ThreadLocal 的家族里还有 Netty 中用到的，```FastThreadLocal```。在全链路跨服务线程间获取调用链路，还有 ```TransmittableThreadLocal```，另外还有 JDK 本身自带的一种线程传递解决方案 ```InheritableThreadLocal```,还有阿里巴巴的```TTL```但站在本文的基础上，了解了最基础的原理，在理解其他的拓展设计，就更容易接受了。
* 此外在我们文中分析时经常会看到探测式清理，其实这也是非常耗时。为此我们在使用 ThreadLocal 一定要记得 ```new ThreadLocal<>().remove();``` 操作。避免弱引用发生GC后，导致内存泄漏的问题。
* 最后，你发现了吗！我们学习这样的底层原理性知识，都离不开数据结构和良好的设计方案，或者说是算法的身影。这些代码才是支撑整个系统良好运行的地基，如果我们可以把一些思路抽取到我们开发的核心业务流程中，也是可以大大提升性能的

## 拓展知识
### 为什么需将Key设置为弱引用？
在理解这个问题之前，我们不妨想一下，如果 Entry 不设置为弱引用会怎么样?以下面的代码为例：
```java
public class static run(){
    ThreadLocal tl = new ThreadLocal();
    Object value = new Object();
    tl.set(value);
}
```
结合之前的例子，我们知道，当执行完上述代码后，当前线程将会把t1和va1ue 作为一个``` Entry ```对象存储在自己拥有的``` ThreadLocalMap ```中。由于 ```t1```和```value ```都间接的被当前线程对象强引用也就是说，**在当前线程对象的生命周期结束前，```t1``` 和```value``` 一直都不会被回收.**
并且，由于我们也没有任何 API能够主动的让线程对象把t1从它拥有的 ThreadLocalMap 中移除，这样等于实质上的发生了**内存泄露**。
而当 Entry 里面的 Key - 也就是 ThreadLocal 被设置为弱引用后，哪怕用户没有及时清空数据，在GC 的时候 JM 也会自动回收 ThreadLocal，这等于**主动标记 Entry 为失效数据**，如此一来，当后续进行增删改等操作的时候，ThreadLocalMap 将会自动清除失效数据，实现内存的自动释放，减小内存泄露的可能性。不过，既然说是“减小”，那么说明还是有可能因为使用不当导致内存泄露的。

### 为什么不选择把 Value 设置为弱引用?
从原理来说，要确认一个 Entry 是失效的，只要有办法让 Key 或者 Value 失效就行，从这个角度上来看，把Key 或者 Value 设置为弱引用都可以实现自动回收的效果。
不过，把 Value 而不是 Key 作为弱引用，最大的问题在于 Value 的生命周期是不确定的。比如，如果缓存的值对象恰好是 String 或者 Integer 类型，由于值本身具备缓存机制导致很难被回收，会进而导致数据迟迟无法失效，进而导致内存泄露。因此，为了避免用户使用常量或长生命周期的对象作为弱引用导致数据迟迟无法被回收，需要把 Key 而不是 Value 设置为弱引用.