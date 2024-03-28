# AbstractQueuedSynchronizer
## ReentrantLock 和 AQS
### ReentrantLock 知识链
![pic](/java/AQS/interview-17-1.png)
在这部分知识学习中，会主要围绕 ReentrantLock 中关于 AQS 的使用进行展开，逐步分析源码了解原理。

AQS 是 AbstractQueuedSynchronizer 的缩写，几乎所有 Lock 都是基于 AQS 来实现了，其底层大量使用 CAS 提供乐观锁服务，在冲突时采用自旋方式进行重试，以此实现轻量级和高效的获取锁。

**另外 AbstractQueuedSynchronizer 是一个抽象类，但并没有定义相应的抽象方法，而是提供了可以被子类继承时覆盖的 ```protected``` 的方法，这样就可以非常方便的支持继承类的使用。**

### 写一个简单的 AQS 同步类
```java
public class MySyncAQS {
    public static void main(String[] args) throws InterruptedException {
        MyLock myLock = new MyLock();
        new ArrayList<>().add(1);
        new Thread(()->{
            System.out.println(Thread.currentThread().getName() + "加锁中");
            myLock.lock(3);
            System.out.println(Thread.currentThread().getName() + "加锁成功");
            myLock.unlock();
            System.out.println(Thread.currentThread().getName() + "解锁第1次成功");
            sleep();
            myLock.unlock();
            System.out.println(Thread.currentThread().getName() + "解锁第2次成功");
            sleep();
            myLock.unlock();
            System.out.println(Thread.currentThread().getName() + "解锁第3次成功");
            sleep();
        }).start();

        TimeUnit.SECONDS.sleep(1);

        new Thread(()->{
            System.out.println(Thread.currentThread().getName() + "加锁中");
            myLock.lock();
            System.out.println(Thread.currentThread().getName() + "加锁成功");
            myLock.unlock();
        }).start();
    }

    private static void sleep() {
        try {
            TimeUnit.SECONDS.sleep(1);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    private static class MyLock implements Lock {

        private static class Sync extends AbstractQueuedSynchronizer{
            @Override
            protected boolean tryAcquire(int arg) {
            	//判断是否被当前线程独占使用
                if(isHeldExclusively()) return true;
                //CAS 加锁
                if(compareAndSetState(0,arg)){
                	//调用AQS，将当前线程设置为独占使用
                    setExclusiveOwnerThread(Thread.currentThread());
                    return true;
                }
                //加锁失败
                return false;
            }

            @Override
            protected boolean tryRelease(int arg) {
            	//获取当前锁加了多少层（可重入锁）
                int state = getState();
                //没锁但是尝试解锁 抛异常
                if(state == 0) {
                    throw new IllegalMonitorStateException();
                }
                if(isHeldExclusively()){
                    //当前线程持有锁才能解锁
                    //System.out.println方法在测试时使用 因为是同步方法 性能不好
                    System.out.printf("当前锁加了 %d 层,%s即将解锁 %d 层%n",state,Thread.currentThread().getName(),arg);
                    setState(state - arg);
                    //锁放完了
                    if(getState() == 0)
                        setExclusiveOwnerThread(null);
                    return true;
                }
                return false;
            }

            @Override
            protected boolean isHeldExclusively() {
                return getExclusiveOwnerThread() == Thread.currentThread();
            }

            protected Condition newCondition(){
                return new ConditionObject();
            }
        }

        private static Sync sync = new Sync();

        @Override
        public void lock() {
            sync.acquire(1);
        }

        public void lock(int arg){
            sync.acquire(arg);
        }

        @Override
        public void lockInterruptibly() throws InterruptedException {
            sync.acquireInterruptibly(1);
        }

        @Override
        public boolean tryLock() {
            return sync.tryAcquire(1);
        }

        @Override
        public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
            return sync.tryAcquireNanos(1,unit.toNanos(time));
        }

        @Override
        public void unlock() {
           sync.release(1);
        }

        @Override
        public Condition newCondition() {
            return sync.newCondition();
        }
    }
}
```
这个实现的过程属于 ReentrantLock 简版，主要包括如下内容：

Sync 类继承 AbstractQueuedSynchronizer，并重写方法：```tryAcquire、tryRelease、isHeldExclusively```。
这三个方法基本是必须重写的，如果不重写在使用的时候就会抛异常 UnsupportedOperationException。
重写的过程也比较简单，主要是使用 AQS 提供的 CAS 方法。以预期值为 0，写入更新值 1，写入成功则获取锁成功。其实这个过程就是对 state 使用 unsafe 本地方法，传递偏移量 stateOffset 等参数，进行值交换操作。```unsafe.compareAndSwapInt(this, stateOffset, expect, update)```
最后提供 lock、unlock 两个方法，实际的类中会实现 Lock 接口中的相应方法，这里为了简化直接自定义这样两个方法。

#### 效果测试
```java
Thread-0加锁中
Thread-0加锁成功
当前锁加了 3 层,Thread-0即将解锁 1 层
Thread-0解锁第1次成功
Thread-1加锁中
当前锁加了 2 层,Thread-0即将解锁 1 层
Thread-0解锁第2次成功
当前锁加了 1 层,Thread-0即将解锁 1 层
Thread-0解锁第3次成功
Thread-1加锁成功
当前锁加了 1 层,Thread-1即将解锁 1 层
```
* 从测试结果看，以上 AQS 实现的同步类，满足预期效果。
* 有了这段代码的概念结构，接下来在分析 ReentrantLock 中的 AQS 使用就有一定的感觉了！

### CAS 介绍
CAS 是 compareAndSet 的缩写，它的应用场景就是对一个变量进行值变更，在变更时会传入两个参数：一个是预期值、另外一个是更新值。如果被更新的变量预期值与传入值一致，则可以变更。

CAS 的具体操作使用到了 unsafe 类，底层用到了本地方法 unsafe.compareAndSwapInt 比较交换方法。

CAS 是一种无锁算法，这种操作是 CPU 指令集操作，只有一步原子操作，速度非常快。而且 CAS 避免了请求操作系统来裁定锁问题，直接由 CPU 搞定，但也不是没有开销，比如 Cache Miss，感兴趣的小伙伴可以自行了解 CPU 硬件相关知识。

## AQS 核心源码分析
### 1. 获取锁流程图
![pic](/java/AQS/interview-17-2.png)
整个 ReentrantLock 中获取锁的核心流程，包括非公平锁和公平锁的一些交叉流程。接下来我们就以此按照此流程来讲解相应的源码部分
### 2. lock
![pic](/java/AQS/interview-17-3.png)
ReentrantLock 实现了非公平锁和公平锁，所以在调用 lock.lock(); 时，会有不同的实现类：

1. 非公平锁，会直接使用 CAS 进行抢占，修改变量 state 值。如果成功则直接把自己的线程设置到 exclusiveOwnerThread，也就是获得锁成功。不成功后续分析
2. 公平锁，则不会进行抢占，而是规规矩矩的进行排队。老实人
### 3. compareAndSetState
```java
final void lock() {
    if (compareAndSetState(0, 1))
        setExclusiveOwnerThread(Thread.currentThread());
    else
        acquire(1);
}
```
在非公平锁的实现类里，获取锁的过程，有这样一段 CAS 操作的代码。```compareAndSetState``` 赋值成功则获取锁。那么 CAS 这里面做了什么操作？  

```java
protected final boolean compareAndSetState(int expect, int update) {
    // See below for intrinsics setup to support this
    return unsafe.compareAndSwapInt(this, stateOffset, expect, update);
}
```
往下翻我们看到这样一段代码，这里是 unsafe 功能类的使用，两个参数到这里变成四个参数。多了 this、stateOffset。this 是对象本身，那么 stateOffset 是什么？  

```java
stateOffset = unsafe.objectFieldOffset
    (AbstractQueuedSynchronizer.class.getDeclaredField("state"));
```
再往下看我们找到，stateOffset 是偏移量值，偏移量是一个固定的值。接下来我们就看看这个值到底是多少！  

引用POM jol-cli
```xml
<!-- https://mvnrepository.com/artifact/org.openjdk.jol/jol-cli -->
<dependency>
    <groupId>org.openjdk.jol</groupId>
    <artifactId>jol-cli</artifactId>
    <version>0.14</version>
</dependency>
```
单元测试
```java
@Test
public void test_stateOffset() throws Exception {
    Unsafe unsafe = getUnsafeInstance();
    long state = unsafe.objectFieldOffset
            (AbstractQueuedSynchronizer.class.getDeclaredField("state"));
    System.out.println(state);
}

// 16
```
* 通过 getUnsafeInstance 方法获取 Unsafe，这是一个固定的方法。
* 在获取 AQS 类中的属性字段 state 的偏移量，16。
* 除了这个属性外你还可以拿到：headOffset、tailOffset、waitStatusOffset、nextOffset，的值，最终自旋来变更这些变量的值。  

### (AQS)acquire
加锁方法
```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```
整个这块代码里面包含了四个方法的调用，如下：

1. tryAcquire，分别由继承 AQS 的公平锁（FairSync）、非公平锁（NonfairSync）实现。
2. addWaiter，该方法是 AQS 的私有方法，主要用途是方法 tryAcquire 返回 false 以后，也就是获取锁失败以后，把当前请求锁的线程添加到队列中，并返回 Node 节点。
3. acquireQueued，负责把 addWaiter 返回的 Node 节点添加到队列结尾，并会执行获取锁操作以及判断是否把当前线程挂起。
4. selfInterrupt，是 AQS 中的 Thread.currentThread().interrupt() 方法调用，它的主要作用是在执行完 acquire 之前自己执行中断操作。
### tryAcquire
```java
//非公平锁的tryAcquire会调用该方法
final boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) {
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```
这部分获取锁的逻辑比较简单，主要包括两部分：

1. 如果 c == 0，锁没有被占用，尝试使用 CAS 方式获取锁，并返回 true。
2. 如果 current == getExclusiveOwnerThread()，也就是当前线程持有锁，则需要调用 setState 进行锁重入操作。setState 不需要加锁，因为是在自己的当前线程下。
3. 最后如果两种都不满足😌，则返回 false。
### addWaiter
```java
private Node addWaiter(Node mode) {
    Node node = new Node(Thread.currentThread(), mode);
    Node pred = tail;
    // 如果队列不为空, 使用 CAS 方式将当前节点设为尾节点
    if (pred != null) {
        node.prev = pred;
        if (compareAndSetTail(pred, node)) {
            pred.next = node;
            return node;
        }
    }
    // 队列为空、CAS失败，将节点插入队列
    enq(node);
    return node;
}
```
* 当执行方法 addWaiter，那么就是 !tryAcquire = true，也就是 tryAcquire 获取锁失败了。
* 接下来就是把当前线程封装到 Node 节点中，加入到 FIFO 队列中。因为先进先出，所以后来的队列加入到队尾
* ```compareAndSetTail``` 不一定一定成功，因为在并发场景下，可能会出现操作失败。那么失败后，则需要调用 enq 方法，该方法会自旋操作，把节点入队列。
#### enq
```java
private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        if (t == null) { // Must initialize
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```
* 自旋转for循环 + CAS 入队列。
* 当队列为空时，则会新创建一个节点，把尾节点指向头节点，然后继续循环。
* 第二次循环时，则会把当前线程的节点添加到队尾。head 节是一个无用节点，这和我们做CLH实现时类似
**注意，从尾节点逆向遍历**

1. 首先这里的节点连接操作并不是原子，也就是说在多线程并发的情况下，可能会出现个别节点并没有设置 next 值，就失败了。
2. 但这些节点的 prev 是有值的，所以需要逆向遍历，让 prev 属性重新指向新的尾节点，直至全部自旋入队列。
### acquireQueued
```java
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor();
            // 当前节点的前驱就是head节点时, 再次尝试获取锁
            if (p == head && tryAcquire(arg)) {
            	//加锁成功后，将该节点设置为头节点
                setHead(node);
                //摘除上一个头节点
                p.next = null; // help GC
                failed = false;
                return interrupted;
            }
            // 获取锁失败后, 判断是否把当前线程挂起
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```
当获取锁流程走到这，说明节点已经加入队列完成。看源码中接下来就是让该方法再次尝试获取锁，如果获取锁失败会判断是否把线程挂起。
#### setHead
```java
private void setHead(Node node) {
    head = node;
    node.thread = null;
    node.prev = null;
}
```
在学习 CLH 公平锁数据结构中讲到Head节点是一个虚节点，如果当前节点的前驱节点是Head节点，那么说明此时Node节点排在队列最前面，可以尝试获取锁
获取锁后设置Head节点，这个过程就是一个出队列过程，原来节点设置Null方便GC。  

#### shouldParkAfterFailedAcquire
```java
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    int ws = pred.waitStatus;
    if (ws == Node.SIGNAL)
    	// SIGNAL 设置了前一个节点完结唤醒，安心干别的去了，这里是睡。
        return true;
    if (ws > 0) { //CANCELLED
        do {
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        pred.next = node;
    } else {
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    return false;
}
```
CANCELLED、SIGNAL、CONDITION 、PROPAGATE ，这四种状态，在这个方法中用到了两种如下：
```java
/**waitStatus value to indicate thread has cancelled*/
static final int CANCELLED =  1;
/** waitStatus value to indicate successor's thread needs unparking */
static final int SIGNAL    = -1;
/** waitStatus value to indicate thread is waiting on condition */
static final int CONDITION = -2;
/**
* waitStatus value to indicate the next acquireShared should
* unconditionally propagate
*/
static final int PROPAGATE = -3;
```
1. CANCELLED，取消排队，放弃获取锁。
2. SIGNAL，标识当前节点的下一个节点状态已经被挂起，意思就是大家一起排队上厕所，队伍太长了，后面的谢飞机说，我去买个油条哈，一会到我了，你微信我哈。其实就是当前线程执行完毕后，需要额外执行唤醒**后继节点**操作。
**那么，以上这段代码主要的执行内容包括：**
1. 如果前一个节点状态是 SIGNAL，则返回 true。安心睡觉😪等着被叫醒
2. 如果前一个节点状态是 CANCELLED，就是它放弃了，则继续向前寻找其他节点。
3. 最后如果什么都没找到，就给前一个节点设置个闹钟 SIGNAL，等着被通知。
#### parkAndCheckInterrupt
```java
if (shouldParkAfterFailedAcquire(p, node) &&
    parkAndCheckInterrupt())
    interrupted = true;

// 线程挂起等待被唤醒    
private final boolean parkAndCheckInterrupt() {
    LockSupport.park(this);
    return Thread.interrupted();
}    
```
* 当方法 `shouldParkAfterFailedAcquire` 返回 false 时，代表同步器改变了前驱节点的状态为 SIGNAL，在下一次循环中， `shouldParkAfterFailedAcquire` 返回 true，再执行 `parkAndCheckInterrupt`() 方法。
* 那么，这一段代码就是对线程的挂起操作，```LockSupport.park(this);```。
* ```Thread.interrupted()``` 检查当前线程的中断标识。

## 总结
* ReentrantLock 的知识比较多，涉及的代码逻辑也比较复杂，在学习的过程中需要对照源码和相关并发书籍和资料一起学习，以及最好的是自身实践。
* AQS 的实现部分涉及的内容较多，例如：state 属性使用 unsafe 提供的本地方法进行 CAS 操作，把初始值 0 改为 1，则获得了锁。addWaiter、acquireQueued、shouldParkAfterFailedAcquire、parkAndCheckInterrupt等，可以细致总结。
* 所有的 Lock 都是基于 AQS 来实现了。AQS 和 Condition 各自维护了不同的队列，在使用 Lock 和 Condition 的时候，就是两个队列的互相移动。这句话可以细细体会。可能文中会有一些不准确或者错字，欢迎留言，我会不断的更新博客。