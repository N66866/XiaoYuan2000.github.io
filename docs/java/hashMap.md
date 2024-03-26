# HashMap
## HashCode为什么使用31作为乘数
![avatar](/interview-3-01.png)
1. 31 是一个奇质数，如果选择偶数会导致乘积运算时数据溢出。

2. 另外在二进制中，2个5次方是32，那么也就是 31 * i == (i << 5) - i。这主要是说乘积运算可以使用位移提升性能，同时目前的JVM虚拟机也会自动支持此类的优化。
![avatar](/interview-3-03.png)
以上就是不同的乘数下的hash碰撞结果图标展示，从这里可以看出如下信息；

乘数是2时，hash的取值范围比较小，基本是堆积到一个范围内了，后面内容会看到这块的展示。
乘数是3、5、7、17等，都有较大的碰撞概率
乘数是31的时候，碰撞的概率已经很小了，基本稳定。
顺着往下看，你会发现199的碰撞概率更小，这就相当于一排奇数的茅坑量多，自然会减少碰撞。但这个范围值已经远超过int的取值范围了，如果用此数作为乘数，又返回int值，就会丢失数据信息。

![avatar](/interview-3-04.png)
> 总结：
以上主要介绍了hashCode选择31作为乘数的主要原因和实验数据验证，算是一个散列的数据结构的案例讲解，在后续的类似技术中，就可以解释其他的源码设计思路了。
看过本文至少应该让你可以从根本上解释了hashCode的设计，关于他的所有问题也就不需要死记硬背了，学习编程内容除了最开始的模仿到深入以后就需要不断的研究数学逻辑和数据结构。
[具体实验过程](http://s.xiaoyuan.space/3ieI5j)

---
## HashMap核心知识，扰动函数、负载因子、扩容链表拆分，深度学习
### 1.1 扰动函数
在HashMap存放元素时候有这样一段代码来处理哈希值，这是java 8的散列值扰动函数，用于优化散列效果；
```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```
### 1.2 为什么使用扰动函数
理论上来说字符串的hashCode是一个int类型值，那可以直接作为数组下标了，且不会出现碰撞。但是这个hashCode的取值范围是[-2147483648, 2147483647]，有将近40亿的长度，谁也不能把数组初始化的这么大，内存也是放不下的。

我们默认初始化的Map大小是16个长度 DEFAULT_INITIAL_CAPACITY = 1 << 4，所以获取的Hash值并不能直接作为下标使用，需要与数组长度进行取模运算得到一个下标值，也就是我们上面做的散列列子。

那么，hashMap源码这里不只是直接获取哈希值，还进行了一次扰动计算，(h = key.hashCode()) ^ (h >>> 16)。把哈希值右移16位，也就正好是自己长度的一半，之后与原哈希值做异或运算，这样就混合了原哈希值中的高位和低位，增大了随机性。计算方式如下图:
![图片](/interview-4-02.png)
说白了，使用扰动函数就是为了增加随机性，让数据元素更加均衡的散列，减少碰撞。

> 总结：
从这两种的对比图可以看出来，在使用了扰动函数后，数据分配的更加均匀了。
数据分配均匀，也就是散列的效果更好，减少了hash的碰撞，让数据存放和获取的效率更佳。
[具体实验过程](http://s.xiaoyuan.space/2TBKUO)

### 2.1 初始化容量和负载因子
从上述实验过程HashMap的例子中以及HashMap默认的初始化大小里，都可以知道，散列数组需要一个2的幂次方的长度，因为只有2的幂次方在减1的时候，才会出现01111这样的值。
这里就有一个问题，我们在初始化HashMap的时候，如果传一个17个的值new HashMap<>(17);，它会怎么处理呢？

### 2.2 寻找2的幂次方最小值
在HashMap的初始化中，有这样一段方法；
```java
public HashMap(int initialCapacity, float loadFactor) {
    ...
    this.loadFactor = loadFactor;
    this.threshold = tableSizeFor(initialCapacity); //阈值
}
/**
 * * 阈值threshold，通过方法tableSizeFor进行计算，是根据初始化来计算的。
 * 这个方法也就是要寻找比初始值大的，最小的那个2进制数值。比如传了17，我应该找到的是32（2的4次幂是16<17,所以找到2的5次幂32）。
 * 
**/
static final int tableSizeFor(int cap) {
    int n = cap - 1;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    return (n < 0) ? 1 : (n >= MAXIMUM_CAPACITY) ? MAXIMUM_CAPACITY : n + 1;
}
/**
 * MAXIMUM_CAPACITY = 1 << 30，这个是临界范围，也就是最大的Map集合。
 * 乍一看可能有点晕😵怎么都在向右移位1、2、4、8、16，这主要是为了把二进制的各个位置都填上1，当二进制的各个位置都是1以后，就是一个标准的2的幂次方减1了，最后把结果加1再返回即可。
 **/
```
那这里我们把17这样一个初始化计算阈值的过程，用图展示出来，方便理解；
![图片](/interview-4-05.png)

### 3.1 负载因子
```java
static final float DEFAULT_LOAD_FACTOR = 0.75f;
```
负载因子是做什么的？

负载因子，可以理解成一辆车可承重重量超过某个阈值时，把货放到新的车上。

那么在HashMap中，负载因子决定了数据量多少了以后进行扩容。这里要提到上面做的HashMap例子，我们准备了7个元素，但是最后还有3个位置空余，2个位置存放了2个元素。 所以可能即使你数据比数组容量大时也是不一定能正正好好的把数组占满的，而是在某些小标位置出现了大量的碰撞，只能在同一个位置用链表存放，那么这样就失去了Map数组的性能。

所以，要选择一个合理的大小下进行扩容，默认值0.75就是说当阈值容量占了3/4时赶紧扩容，减少Hash碰撞。

**同时0.75是一个默认构造值，在创建HashMap也可以调整，比如你希望用更多的空间换取时间，可以把负载因子调的更小一些，减少碰撞。**

### 4.1 扩容元素拆分
为什么扩容，因为数组长度不足了。那扩容最直接的问题，就是需要把元素拆分到新的数组中。拆分元素的过程中，原jdk1.7中会需要重新计算哈希值，但是到jdk1.8中已经进行优化，不再需要重新计算，提升了拆分的性能，设计的还是非常巧妙的。
[实验过程](http://s.xiaoyuan.space/3D9Lfx)
随机使用一些字符串计算他们分别在16位长度和32位长度数组下的索引分配情况,还可以观察🕵出一个非常重要的信息，原哈希值与扩容新增出来的长度16，进行&运算，如果值等于0，则下标位置不变。如果不为0，那么新的位置则是原来位置上加16。
![图片](/interview-4-06.png)
* 这张图就是原16位长度数组元素，向32位扩容后数组转移的过程。
* 对31取模保留低5位，对15取模保留低4位，两者的差异就在于第5位是否为1，是的话则需要加上增量，为0的话则不需要改变
* 其中黄色区域元素zuio因计算结果 hash & oldCap(旧容量二进制值) 低位第5位为1，则被迁移到下标位置24。
* 同时还是用重新计算哈希值的方式验证了，确实分配到24的位置，因为这是在二进制计算中补1的过程，所以可以通过上面简化的方式确定哈希值的位置。
* 那么为什么 e.hash & oldCap == 0 为什么可以判断当前节点是否需要移位, 而不是再次计算hash;

当HashMap的元素数量达到负载因子（load factor）与当前容量（capacity）的乘积时，HashMap会进行扩容。通常，新的容量是旧容量的两倍，这是为了保持数组大小始终为2的幂次，这样做的目的是为了优化索引计算和减少哈希碰撞。
在扩容过程中，每个元素的新索引位置是通过其哈希值与新容量减一（newCap - 1）进行按位与操作（hash & (newCap - 1)）来确定的。由于新容量是旧容量的两倍，所以oldCap的值在这个计算中用于确定元素是否需要移动到新的位置。
具体来说，如果一个元素的哈希值与oldCap进行按位与操作的结果为0（hash & oldCap == 0），那么该元素在新数组中的位置与旧数组中的位置相同。如果结果不为0（hash & oldCap != 0），则该元素在新数组中的位置将是其在旧数组中的位置加上oldCap的值。

当HashMap初始化容量是16时，确实是使用hash & (16 - 1)来计算元素的位置。但是，当HashMap扩容时，新的容量会变成原来的两倍，即变为32。这时，元素位置的计算方式也会随之改变，变为hash & (32 - 1)。
由于容量翻倍，新的容量的二进制表示中会多出一个高位的1（例如，从00010000变为00100000），这意味着在计算索引时会考虑哈希值的更多位。**因此，即使是同一个哈希值，在新的容量下计算出的索引可能会不同。
在扩容过程中，对于每个已存在的元素，我们需要重新计算它们在新数组中的位置。这时，我们会比较哈希值与旧容量（oldCap）的按位与结果：**
```java
if ((hash & oldCap) == 0) {
    // 元素保持在原来的索引位置
} else {
    // 元素移动到原索引位置加上oldCap的位置
    newIndex = index + oldCap;
}
```
这个条件检查实际上是在检查哈希值的那个新增的位（对应于旧容量的最高位）是0还是1。如果是0，那么元素在新数组中的位置与旧数组中的位置相同；如果是1，那么元素需要移动到旧索引位置加上oldCap的位置。
这样做的目的是为了在扩容时保持已有元素的相对位置，同时将它们均匀地分布在新的数组中，以此来保持HashMap的性能。
这种方法利用了2的幂次的特性，确保了在扩容时只需要简单的按位与操作就可以快速确定元素在新数组中的位置，同时避免了重新计算哈希值。

---

## HashMap数据插入、查找、删除、遍历，源码分析
**HashMap还有基本的数据功能；存储、删除、获取、遍历，在这些功能中经常会听到链表、红黑树、之间转换等功能。而红黑树是在jdk1.8引入到HashMap中解决链表过长问题的，简单说当链表长度>=8时，将链表转换位红黑树(当然这里还有一个扩容的知识点，不一定都会树化[MIN_TREEIFY_CAPACITY])。**
### 插入

简单来说就是通过你的Key值取得哈希再计算下标，之后把相应的数据存放到里面。但在这个过程中会遇到一些问题，比如；
* 如果出现哈希值计算的下标碰撞了怎么办？
* 如果碰撞了是扩容数组还是把值存成链表结构，让一个节点有多个值存放呢？
* 如果存放的数据的链表过长，就失去了散列表的性能了，怎么办呢？
* 如果想解决链表过长，什么时候使用树结构呢，使用哪种树呢？
#### 插入流程
![图片](/interview-5-01.png)
以上就是HashMap中一个数据插入的整体流程，包括了；计算下标、何时扩容、何时链表转红黑树等，具体如下；
1. 首先进行哈希值的扰动，获取一个新的哈希值。(key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
2. 判断tab是否为空或者长度为0，如果是则进行扩容操作。
```java
if ((tab = table) == null || (n = tab.length) == 0)
    n = (tab = resize()).length;
```
3. 根据哈希值计算下标，如果对应下标正好没有存放数据，则直接插入即可否则需要覆盖。**tab[i = (n - 1) & hash])**
4. 判断tab[i]是否为树节点，否则向链表中插入数据，是则向树中插入节点。
5. 如果链表中插入节点的时候，链表长度大于等于8，则需要把链表转换为红黑树。**treeifyBin(tab, hash)**;
6. 最后所有元素处理完成后，判断是否超过阈值；**threshold**，超过则扩容。
7. **treeifyBin**,是一个链表转树的方法，但不是所有的链表长度为8后都会转成树，还需要判断存放key值的数组桶长度是否小于64 **MIN_TREEIFY_CAPACITY**。如果小于则需要扩容，扩容后链表上的数据会被拆分散列的相应的桶节点上，也就把链表长度缩短了。

JDK 1.8的HashMap put源码如下：
```java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
               boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    // 初始化桶数组 table，table 被延迟到插入新数据时再进行初始化
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;
    // 如果桶中不包含键值对节点引用，则将新键值对节点的引用存入桶中即可
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    else {
        Node<K,V> e; K k;
        // 如果键的值以及节点 hash 等于链表中的第一个键值对节点时，则将 e 指向该键值对
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
            e = p;
            
        // 如果桶中的引用类型为 TreeNode，则调用红黑树的插入方法
        else if (p instanceof TreeNode)  
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
        else {
            // 对链表进行遍历，并统计链表长度
            for (int binCount = 0; ; ++binCount) {
                // 链表中不包含要插入的键值对节点时，则将该节点接在链表的最后
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null);
                    // 如果链表长度大于或等于树化阈值，则进行树化操作
                    if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                        treeifyBin(tab, hash);
                    break;
                }
                
                // 条件为 true，表示当前链表包含要插入的键值对，终止遍历
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    break;
                p = e;
            }
        }
        
        // 判断要插入的键值对是否存在 HashMap 中
        if (e != null) { // existing mapping for key
            V oldValue = e.value;
            // onlyIfAbsent 表示是否仅在 oldValue 为 null 的情况下更新键值对的值
            if (!onlyIfAbsent || oldValue == null)
                e.value = value;
            afterNodeAccess(e);
            return oldValue;
        }
    }
    ++modCount;
    // 键值对数量超过阈值时，则进行扩容
    if (++size > threshold)
        resize();
    afterNodeInsertion(evict);
    return null;
}
```
#### 扩容机制
具体扩容机制在上一章节已提到，本章节主要讲述实现代码
```java
final Node<K,V>[] resize() {
    Node<K,V>[] oldTab = table;
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    int oldThr = threshold;
    int newCap, newThr = 0;
    // Cap 是 capacity 的缩写，容量。如果容量不为空，则说明已经初始化。
    if (oldCap > 0) {
        // 如果容量达到最大1 << 30则不再扩容
        if (oldCap >= MAXIMUM_CAPACITY) {
            threshold = Integer.MAX_VALUE;
            return oldTab;
        }
        
        // 按旧容量和阈值的2倍计算新容量和阈值
        else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY &&
                 oldCap >= DEFAULT_INITIAL_CAPACITY)
            newThr = oldThr << 1; // double threshold
    }
    else if (oldThr > 0) // initial capacity was placed in threshold
    
        // initial capacity was placed in threshold 翻译过来的意思，如下；
        // 初始化时，将 threshold 的值赋值给 newCap，
        // HashMap 使用 threshold 变量暂时保存 initialCapacity 参数的值
        newCap = oldThr;
    else {               // zero initial threshold signifies using defaults
        // 这一部分也是，源代码中也有相应的英文注释
        // 调用无参构造方法时，数组桶数组容量为默认容量 1 << 4; aka 16
        // 阈值；是默认容量与负载因子的乘积，0.75
        newCap = DEFAULT_INITIAL_CAPACITY;
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);
    }
    
    // newThr为0，则使用阈值公式计算容量
    if (newThr == 0) {
        float ft = (float)newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY
                  (int)ft : Integer.MAX_VALUE);
    }
    threshold = newThr;
    
    @SuppressWarnings({"rawtypes","unchecked"})
        // 初始化数组桶，用于存放key
        Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    table = newTab;
    if (oldTab != null) {
        // 如果旧数组桶，oldCap有值，则遍历将键值映射到新数组桶中
        for (int j = 0; j < oldCap; ++j) {
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {
                oldTab[j] = null;
                if (e.next == null)
                    newTab[e.hash & (newCap - 1)] = e;
                else if (e instanceof TreeNode)
                    // 这里split，是红黑树拆分操作。在重新映射时操作的。
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);
                else { // preserve order
                    Node<K,V> loHead = null, loTail = null;
                    Node<K,V> hiHead = null, hiTail = null;
                    Node<K,V> next;
                    // 这里是链表，如果当前是按照链表存放的，则将链表节点按原顺序进行分组{这里有专门的文章介绍，如何不需要重新计算哈希值进行拆分《HashMap核心知识，扰动函数、负载因子、扩容链表拆分，深度学习》}
                    do {
                        next = e.next;
                        if ((e.hash & oldCap) == 0) {
                            if (loTail == null)
                                loHead = e;
                            else
                                loTail.next = e;
                            loTail = e;
                        }
                        else {
                            if (hiTail == null)
                                hiHead = e;
                            else
                                hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);
                    
                    // 将分组后的链表映射到桶中
                    if (loTail != null) {
                        loTail.next = null;
                        newTab[j] = loHead;
                    }
                    if (hiTail != null) {
                        hiTail.next = null;
                        newTab[j + oldCap] = hiHead;
                    }
                }
            }
        }
    }
    return newTab;
}
```
1. 扩容时计算出新的newCap、newThr，这是两个单词的缩写，一个是Capacity ，另一个是阈Threshold
2. newCap用于创建新的数组桶 new Node[newCap];
3. 随着扩容后，原来那些因为哈希碰撞，存放成链表和红黑树的元素，都需要进行拆分存放到新的位置中

#### 链表树化
HashMap这种散列表的数据结构，最大的性能在于可以O(1)时间复杂度定位到元素，但因为哈希碰撞不得已在一个下标里存放多组数据，那么jdk1.8之前的设计只是采用链表的方式进行存放，如果需要从链表中定位到数据时间复杂度就是O(n)，链表越长性能越差。因为在jdk1.8中把过长的链表也就是8个，优化为自平衡的红黑树结构，以此让定位元素的时间复杂度优化近似于O(logn)，这样来提升元素查找的效率。但也不是完全抛弃链表，因为在元素相对不多的情况下，链表的插入速度更快，所以综合考虑下设定阈值为8才进行红黑树转换操作。
![图片](/interview-5-02.png)
以上就是一组链表转换为红黑树的情况，元素包括；40、51、62、73、84、95、150、161 这些是经过实际验证可分配到Idx：12的节点

通过这张图，基本可以有一个链表换行到红黑树的印象，接下来阅读下对应的源码
```java
final void treeifyBin(Node<K,V>[] tab, int hash) {
    int n, index; Node<K,V> e;
    // 这块就是我们上面提到的，不一定树化还可能只是扩容。主要桶数组容量是否小于64 MIN_TREEIFY_CAPACITY 
    if (tab == null || (n = tab.length) < MIN_TREEIFY_CAPACITY)
        resize();
    else if ((e = tab[index = (n - 1) & hash]) != null) {
    	// 又是单词缩写；hd = head (头部)，tl = tile (结尾)
        TreeNode<K,V> hd = null, tl = null;
        do {
            // 将普通节点转换为树节点，但此时还不是红黑树，也就是说还不一定平衡
            TreeNode<K,V> p = replacementTreeNode(e, null);
            if (tl == null)
                hd = p;
            else {
                p.prev = tl;
                tl.next = p;
            }
            tl = p;
        } while ((e = e.next) != null);
        if ((tab[index] = hd) != null)
            // 转红黑树操作，这里需要循环比较，染色、旋转。关于红黑树，在下一章节详细讲解
            hd.treeify(tab);
    }
}
```
1. 链表树化的条件有两点；链表长度大于等于8、桶容量大于64，否则只是扩容，不会树化。
2. 链表树化的过程中是先由链表转换为树节点，此时的树可能不是一颗平衡树。同时在树转换过程中会记录链表的顺序，tl.next = p，这主要方便后续树转链表和拆分更方便。
3. 链表转换成树完成后，在进行红黑树的转换。先简单介绍下，红黑树的转换需要染色和旋转，以及比对大小。在比较元素的大小中，有一个比较有意思的方法，tieBreakOrder加时赛，这主要是因为HashMap没有像TreeMap那样本身就有Comparator的实现。
#### 红黑树转链
在链表转红黑树中我们重点介绍了一句，在转换树的过程中，记录了原有链表的顺序。

那么，这就简单了，红黑树转链表时候，直接把TreeNode转换为Node即可，源码如下；
```java
final Node<K,V> untreeify(HashMap<K,V> map) {
    Node<K,V> hd = null, tl = null;
    // 遍历TreeNode
    for (Node<K,V> q = this; q != null; q = q.next) {
    	// TreeNode替换Node
        Node<K,V> p = map.replacementNode(q, null);
        if (tl == null)
            hd = p;
        else
            tl.next = p;
        tl = p;
    }
    return hd;
}

// 替换方法
Node<K,V> replacementNode(Node<K,V> p, Node<K,V> next) {
    return new Node<>(p.hash, p.key, p.value, next);
}
```
因为记录了链表关系，所以替换过程很容易。所以好的数据结构可以让操作变得更加容易。


### 查找
![图片](/interview-5-03.png)
```java
public V get(Object key) {
    Node<K,V> e;
    // 同样需要经过扰动函数计算哈希值
    return (e = getNode(hash(key), key)) == null ? null : e.value;
}

final Node<K,V> getNode(int hash, Object key) {
    Node<K,V>[] tab; Node<K,V> first, e; int n; K k;
    // 判断桶数组的是否为空和长度值
    if ((tab = table) != null && (n = tab.length) > 0 &&
        // 计算下标，哈希值与数组长度-1
        (first = tab[(n - 1) & hash]) != null) {
        if (first.hash == hash && // always check first node
            ((k = first.key) == key || (key != null && key.equals(k))))
            return first;
        if ((e = first.next) != null) {
            // TreeNode 节点直接调用红黑树的查找方法，时间复杂度O(logn)
            if (first instanceof TreeNode)
                return ((TreeNode<K,V>)first).getTreeNode(hash, key);
            // 如果是链表就依次遍历查找
            do {
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    return e;
            } while ((e = e.next) != null);
        }
    }
    return null;
}
```
1. 扰动函数的使用，获取新的哈希值，这在上一章节已经讲过
2. 下标的计算，同样也介绍过 tab[(n - 1) & hash])
3. 确定了桶数组下标位置，接下来就是对红黑树和链表进行查找和遍历操作了
### 删除
```java
 public V remove(Object key) {
     Node<K,V> e;
     return (e = removeNode(hash(key), key, null, false, true)) == null ?
         null : e.value;
 }
 
final Node<K,V> removeNode(int hash, Object key, Object value,
                           boolean matchValue, boolean movable) {
    Node<K,V>[] tab; Node<K,V> p; int n, index;
    // 定位桶数组中的下标位置，index = (n - 1) & hash
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (p = tab[index = (n - 1) & hash]) != null) {
        Node<K,V> node = null, e; K k; V v;
        // 如果键的值与链表第一个节点相等，则将 node 指向该节点
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
            node = p;
        else if ((e = p.next) != null) {
            // 树节点，调用红黑树的查找方法，定位节点。
            if (p instanceof TreeNode)
                node = ((TreeNode<K,V>)p).getTreeNode(hash, key);
            else {
                // 遍历链表，找到待删除节点
                do {
                    if (e.hash == hash &&
                        ((k = e.key) == key ||
                         (key != null && key.equals(k)))) {
                        node = e;
                        break;
                    }
                    p = e;
                } while ((e = e.next) != null);
            }
        }
        
        // 删除节点，以及红黑树需要修复，因为删除后会破坏平衡性。链表的删除更加简单。
        if (node != null && (!matchValue || (v = node.value) == value ||
                             (value != null && value.equals(v)))) {
            if (node instanceof TreeNode)
                ((TreeNode<K,V>)node).removeTreeNode(this, tab, movable);
            else if (node == p)
                tab[index] = node.next;
            else
                p.next = node.next;
            ++modCount;
            --size;
            afterNodeRemoval(node);
            return node;
        }
    }
    return null;
} 
```
* 删除的操作也比较简单，这里面都没有太多的复杂的逻辑。
* 另外红黑树的操作因为被包装了，只看使用上也是很容易。

[原文点此](http://s.xiaoyuan.space/39WAGt)

---
### 扩展知识
**jdk1.8（不含）以前版本并发插入时有几率出发死循环bug，因为1.8前版本是使用头插法，在并发环境下添加且触发扩容**，因为多个线程同时进行 put 操作，导致链表形成环形数据结构，一旦形成环形数据结构，在 get(key) 的时候就会产生死循环。
举个例子：
1. 线程T1 和 T2 进行扩容操作，T1 和 T2 指向的是链表头结点A，而下一个节点为B，即T1.next = T2.next = B;![图片](https://www.javacn.site/image/1641896824515-f36af0da-8c0a-4d41-a43c-d48c52204881.png)。
2. T2时间片用完进入休眠状态，T1开始执行扩容操作，扩容完成后T2被唤醒：![图片](https://www.javacn.site/image/1641898700546-c414add5-9035-4085-8bdb-e0e7a9eba936.png)。从上图可知线程 T1 执行之后，因为是头插法，所以 HashMap 的顺序已经发生了改变，但线程 T2 对于发生的一切是不可知的，所以它的指向元素依然没变，如上图展示的那样，T2 指向的是 A 元素，T2.next 指向的节点是 B 元素
3. 当线程 T1 执行完，而线程 T2 恢复执行时，死循环就建立了，如下图所示：![图片](https://www.javacn.site/image/1641897351523-7ec0a83d-d5d0-457a-8bed-d356c48393a0.png)因为 T1 执行完扩容之后 B 节点的下一个节点是 A，而 T2 线程指向的首节点是 A，第二个节点是 B，这个顺序刚好和 T1 扩完容完之后的节点顺序是相反的。T1 执行完之后的顺序是 B 到 A，而 T2 的顺序是 A 到 B，这样 A 节点和 B 节点就形成死循环了，这就是 HashMap 死循环导致的原因。

**解决办法：**
1. 升级到高版本 JDK（JDK 1.8 以上），高版本 JDK 使用的是尾插法插入新元素的，所以不会产生死循环的问题；
2. 使用线程安全容器 ConcurrentHashMap 替代（推荐使用此方案）；
3. 使用线程安全容器 Hashtable 替代（性能低，不建议使用）；
4. 使用 synchronized 或 Lock 加锁 HashMap 之后，再进行操作，相当于多线程排队执行（比较麻烦，也不建议使用）。

