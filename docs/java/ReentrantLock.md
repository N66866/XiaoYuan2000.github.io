# ReentrantLock
## ReentrantLock介绍
ReentrantLock 是一个可重入且独占式锁，具有与 synchronized 监视器(monitor enter、monitor exit)锁基本相同的行为和语意。但与 synchronized 相比，它更加灵活、强大、增加了轮询、超时、中断等高级功能以及可以创建公平和非公平锁。
## ReentrantLock知识链条
![pic](/java/reentrantLock/interview-16-01.png)
ReentrantLock 是基于 Lock 实现的可重入锁，所有的 Lock 都是基于 AQS 实现的，AQS 和 Condition 各自维护不同的对象，在使用 Lock 和 Condition 时，其实就是两个队列的互相移动。它所提供的共享锁、互斥锁都是基于对 state 的操作。而它的可重入是因为实现了同步器 Sync，在 Sync 的两个实现类中，包括了公平锁和非公平锁。

这个公平锁的具体实现，就是我们本章节要介绍的重点，了解什么是公平锁、公平锁的具体实现。学习完基础的知识可以更好的理解 ReentrantLock
## ReentrantLock公平锁代码
### 初始化
```java
ReentrantLock lock = new ReentrantLock(true);  // true：公平锁 false：非公平锁
lock.lock();
try {
    // todo
} finally {
    lock.unlock();
}
```
* 初始化构造函数入参，选择是否为初始化公平锁。
* 其实一般情况下并不需要公平锁，除非你的场景中需要保证顺序性。
* 使用 ReentrantLock 切记需要在 finally 中关闭，```lock.unlock()```。
### 公平锁、非公平锁，选择
```java
//ReentrantLock 构造方法
public ReentrantLock(boolean fair) {
    sync = fair ? new FairSync() : new NonfairSync();
}
```
* 构造函数中选择公平锁（FairSync）、非公平锁（NonfairSync）。
### hasQueuedPredecessors
```java
static final class FairSync extends Sync {

    protected final boolean tryAcquire(int acquires) {
        final Thread current = Thread.currentThread();
        int c = getState();
        if (c == 0) {
            if (!hasQueuedPredecessors() &&
                compareAndSetState(0, acquires)) {
                setExclusiveOwnerThread(current);
                return true;
            }
        }
		...
    }
}
```
* 公平锁和非公平锁，主要是在方法 tryAcquire 中，是否有``` !hasQueuedPredecessors() ```判断。
> 所以hasQueuedPredecessors()这个环节容不得半点闪失，否则会直接破坏掉公平性，假如现在出现了这样的情况：
线程1已经持有锁了，这时线程2来争抢这把锁，走到hasQueuedPredecessors()，判断出为false，线程2继续运行，然后线程2肯定获取锁失败（因为锁这时是被线程1占有的），因此就进入到等待队列中,而碰巧不巧，这个时候线程3也来抢锁了，按照正常流程走到了hasQueuedPredecessors()方法，线程3这时就紧接着准备开始CAS操作了，又碰巧，这时线程1释放锁了，现在的情况就是，线程3直接开始CAS判断，而线程2还在插入节点状态，结果可想而知，居然是线程3先拿到了锁，这显然是违背了公平锁的公平机制。![pic](/java/reentrantLock/interview-16-05.png)**因此公不公平全看hasQueuedPredecessors()，而此方法只有在等待队列中存在节点时才能保证不会出现问题。所以公平锁，只有在等待队列存在节点时，才是真正公平的。**

### 队列首位判断
```java
public final boolean hasQueuedPredecessors() {
    Node t = tail; // Read fields in reverse initialization order
    Node h = head;//链表头节点 不存储数据
    Node s;
    return h != t && //队列不为空
        ((s = h.next) == null || s.thread != Thread.currentThread()); //如果有节点且不是当前线程等待就返回true 即有线程在等待锁
}
```
* 在这个判断中主要就是看当前线程是不是同步队列的首位，是：true、否：false
* 这部分就涉及到了公平锁的实现，CLH（Craig，Landin and Hagersten）。三个作者的首字母组合
## 什么是公平锁
![pic](/java/reentrantLock/interview-16-02.png)
公平锁就像是马路边上的卫生间，上厕所需要排队。当然如果有人不排队，那么就是非公平锁了，比如领导要先上。
CLH 是一种基于单向链表的高性能、公平的自旋锁。**AQS**中的队列是CLH变体的虚拟双向队列（FIFO 先进先出），AQS是通过将每条请求共享资源的线程封装成一个节点来实现锁的分配。
为了更好的学习理解 CLH 的原理，就需要有实践的代码。接下来一 CLH 为核心分别介绍4种公平锁的实现，从而掌握最基本的技术栈知识。
## 公平锁实现
### CLH
![pic](/java/reentrantLock/interview-16-03.png)
#### 代码实现
```java
public class CLHLock implements Lock {

    private final ThreadLocal<CLHLock.Node> prev;
    private final ThreadLocal<CLHLock.Node> node;
    private final AtomicReference<CLHLock.Node> tail = new AtomicReference<>(new CLHLock.Node());

    private static class Node {
        private volatile boolean locked;
    }

    public CLHLock() {
        this.prev = ThreadLocal.withInitial(() -> null);
        this.node = ThreadLocal.withInitial(CLHLock.Node::new);
    }

    @Override
    public void lock() {
    	//获取当前节点 (B)
        final Node node = this.node.get();
        //将锁标识置真
        node.locked = true;
        //将当前节点放进队列的尾部并获取原尾结点 (获取A)
        Node pred_node = this.tail.getAndSet(node);
 		//将原尾结点设置为当前节点的前驱结点( A<-B)
        this.prev.set(pred_node);
        // 自旋 等待前驱结点的锁标识释放
        while (pred_node.locked);
    }

    @Override
    public void unlock() {
    	//获取当前节点
        final Node node = this.node.get();
        //将锁标识释放 下一节点的自旋结束
        node.locked = false;
        //将当前节点设置为自身的前驱节点(释放自己，让下一个节点的前驱结点变为自己的前驱结点，把自己摘走 null <-A <- B <- C ，把A自己摘走 null <- B)，等待GC
        this.node.set(this.prev.get());
    }

}
```
#### 代码讲解
CLH（Craig，Landin and Hagersten），是一种基于链表的可扩展、高性能、公平的自旋锁。

在这段代码的实现过程中，相当于是虚拟出来一个链表结构，由 AtomicReference 的方法 getAndSet 进行衔接。getAndSet 获取当前元素，设置新的元素

* **lock()**  

1. 通过 this.node.get() 获取当前节点，并设置 locked 为 true。
2. 接着调用 this.tail.getAndSet(node)，获取当前尾部节点 pred_node，同时把新加入的节点设置成尾部节点。
3. 之后就是把 this.prev 设置为之前的尾部节点，也就相当于链路的指向。
4. 最后就是自旋 while (pred_node.locked)，直至程序释放。  

* **unlock()**
1. 释放锁的过程就是拆链，把释放锁的节点设置为false node.locked = false。
2. 之后最重要的是把当前节点设置为上一个节点，这样就相当于把自己的节点拆下来了，等着垃圾回收。
CLH队列锁的优点是空间复杂度低，在SMP（Symmetric Multi-Processor）对称多处理器结构（一台计算机由多个CPU组成，并共享内存和其他资源，所有的CPU都可以平等地访问内存、I/O和外部中断）效果还是不错的。但在 NUMA(Non-Uniform Memory Access) 下效果就不太好了，这部分知识可以自行扩展。

---
### MCSLock
#### 代码实现
```java
public class MCSLock implements Lock {

    private AtomicReference<MCSLock.Node> tail = new AtomicReference<>(null);
    private ThreadLocal<MCSLock.Node> node;

    private static class Node {
        private volatile boolean locked = false;
        private volatile Node next = null;
    }

    public MCSLock() {
        node = ThreadLocal.withInitial(Node::new);
    }

    @Override
    public void lock() {
        Node node = this.node.get();
        Node preNode = tail.getAndSet(node);
        if (null == preNode) {
            node.locked = true;
            return;
        }
        node.locked = false;
        preNode.next = node;
        while (!node.locked) ;
    }

    @Override
    public void unlock() {
        Node node = this.node.get();
        if (null != node.next) {
            node.next.locked = true;
            node.next = null;
            return;
        }
        if (tail.compareAndSet(node, null)) {
            return;
        }
        while (node.next == null) ;
    }

}
```
#### 代码讲解
MCS 来自于发明人名字的首字母： John Mellor-Crummey和Michael Scott。  

它也是一种基于链表的可扩展、高性能、公平的自旋锁，但与 CLH 不同。它是真的有下一个节点 next，添加这个真实节点后，它就可以只在本地变量上自旋，而 CLH 是前驱节点的属性上自旋。
因为自旋节点的不同，导致 CLH 更适合于 SMP 架构、MCS 可以适合 NUMA 非一致存储访问架构。**你可以想象成 CLH 更需要线程数据在同一块内存上效果才更好，MCS 因为是在本店变量自选，所以无论数据是否分散在不同的CPU模块都没有影响。**  

代码实现上与 CLH 没有太多差异，这里就不在叙述了，可以看代码学习。

---
### TIcketLock
![pic](/java/reentrantLock/interview-16-04.png)
#### 代码实现
```java
public class TicketLock implements Lock {

    private AtomicInteger serviceCount = new AtomicInteger(0);
    private AtomicInteger ticketCount = new AtomicInteger(0);
    private final ThreadLocal<Integer> owner = new ThreadLocal<>();

    @Override
    public void lock() {
        owner.set(ticketCount.getAndIncrement());
        while (serviceCount.get() != owner.get());
    }

    @Override
    public void unlock() {
        serviceCount.compareAndSet(owner.get(), owner.get() + 1);
        owner.remove();
    }
}
```
#### 代码讲解
TicketLock 就像你去银行、呷哺给你的一个排号卡一样，叫到你号你才能进去。属于严格的公平性实现，但是多处理器系统上，每个进程/线程占用的处理器都在读写同一个变量，每次读写操作都需要进行多处理间的缓存同步，非常消耗系统性能。

代码实现上也比较简单，lock() 中设置拥有者的号牌，并进入自旋比对。unlock() 中使用 CAS 进行解锁操作，并处理移除。

## 总结
* ReentrantLock 是基于 Lock 实现的可重入锁。 对于公平锁 CLH 的实现，只是这部分知识的冰山一角，但有这一角，就可以很好热身便于后续的学习。
* ReentrantLock 使用起来更加灵活，可操作性也更大，但一定要在 finally 中释放锁，目的是保证在获取锁之后，最终能够被释放。同时不要将获取锁的过程写在 try 里面。避免加锁异常被忽略
* 公平锁的实现依据不同场景和SMP、NUMA（非一致性内存访问）的使用，会有不同的优劣效果。在实际的使用中一般默认会选择非公平锁，即使是自旋也是耗费性能的，一般会用在较少等待的线程中，避免自旋时过长。