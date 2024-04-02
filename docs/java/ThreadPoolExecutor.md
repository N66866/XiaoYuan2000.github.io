# ThreadPoolExecutor
## ThreadPoolExecutor线程池实现原理
### 线程池使用例子
```java
//核心线程、最大线程、空闲线程存活时间、阻塞队列存储等待任务。还有个第五参数：拒绝策略
ThreadPoolExecutor threadPoolExecutor = new ThreadPoolExecutor(10, 10, 0L, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(10));
threadPoolExecutor.execute(() -> {
    System.out.println("Hi 线程池！");
});
threadPoolExecutor.shutdown();

// Executors.newFixedThreadPool(10);
// Executors.newCachedThreadPool();
// Executors.newScheduledThreadPool(10);
// Executors.newSingleThreadExecutor();

```

---
### 手写线程池
#### 实现流程
其实很多时候一段功能代码的核心主逻辑可能并没有多复杂，但为了让核心流程顺利运行，就需要额外添加很多分支的辅助流程。就像我常说的，为了保护手才把擦屁屁纸弄那么大！
![pic](/java/thread/interview-21-1.png)
关于上图，这个手写线程池的实现也非常简单，只会体现出核心流程，包括：

1. 有n个一直在运行的线程，相当于我们创建线程池时允许的线程池大小。
2. 把线程提交给线程池运行。
3. 如果运行线程数量大于等于核心线程数，则把线程放入队列中。
4. 如果队列中容量已添加满，则判断判断当前正在运行的线程数量是否小于设定的最大线程数。若小于则线程池继续创建线程执行线程，若大于则走拒绝策略。
5. 最后当有空闲时，则获取队列中线程进行运行。

---
#### 实现代码
```java
public class ThreadPoolTrader implements Executor {

    private final AtomicInteger ctl = new AtomicInteger(0);

    private volatile int corePoolSize;
    private volatile int maximumPoolSize;

    private final BlockingQueue<Runnable> workQueue;

    public ThreadPoolTrader(int corePoolSize, int maximumPoolSize, BlockingQueue<Runnable> workQueue) {
        this.corePoolSize = corePoolSize;
        this.maximumPoolSize = maximumPoolSize;
        this.workQueue = workQueue;
    }

    @Override
    public void execute(Runnable command) {
        int c = ctl.get();
        if (c < corePoolSize) {
            if (!addWorker(command)) {
                reject();
            }
            return;
        }
        if (!workQueue.offer(command)) {
            if (!addWorker(command)) {
                reject();
            }
        }
    }

    private boolean addWorker(Runnable firstTask) {
        if (ctl.get() >= maximumPoolSize) return false;

        Worker worker = new Worker(firstTask);
        worker.thread.start();
        ctl.incrementAndGet();
        return true;
    }

    private final class Worker implements Runnable {

        final Thread thread;
        Runnable firstTask;

        public Worker(Runnable firstTask) {
            this.thread = new Thread(this);
            this.firstTask = firstTask;
        }

        @Override
        public void run() {
            Runnable task = firstTask;
            try {
            	//第一次运行时task = firstTask != null 所以会先执行一次firstT再继续循环
                while (task != null || (task = getTask()) != null) {
                    task.run();
                    if (ctl.get() > maximumPoolSize) {
                        break;
                    }
                    task = null;
                }
            } finally {
                ctl.decrementAndGet();
            }
        }

        private Runnable getTask() {
            for (; ; ) {
                try {
                    System.out.println("workQueue.size：" + workQueue.size());
                    return workQueue.take();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    private void reject() {
        throw new RuntimeException("Error！ctl.count：" + ctl.get() + " workQueue.size：" + workQueue.size());
    }

    public static void main(String[] args) {
        ThreadPoolTrader threadPoolTrader = new ThreadPoolTrader(2, 2, new ArrayBlockingQueue<Runnable>(10));

        for (int i = 0; i < 10; i++) {
            int finalI = i;
            threadPoolTrader.execute(() -> {
                try {
                    Thread.sleep(1500);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                System.out.println("任务编号：" + finalI);
            });
        }
    }

}

// 测试结果

任务编号：1
任务编号：0
workQueue.size：8
workQueue.size：8
任务编号：3
workQueue.size：6
任务编号：2
workQueue.size：5
任务编号：5
workQueue.size：4
任务编号：4
workQueue.size：3
任务编号：7
workQueue.size：2
任务编号：6
workQueue.size：1
任务编号：8
任务编号：9
workQueue.size：0
workQueue.size：0
```
以上，关于线程池的实现还是非常简单的，从测试结果上已经可以把最核心的池化思想体现出来了。主要功能逻辑包括：

* ctl，用于记录线程池中线程数量。
* corePoolSize、maximumPoolSize，用于限制线程池容量。
* workQueue，线程池队列，也就是那些还不能被及时运行的线程，会被装入到这个队列中。
* execute，用于提交线程，这个是通用的接口方法。在这个方法里主要实现的就是，当前提交的线程是加入到worker、队列还是放弃。
* addWorker，主要是类 Worker 的具体操作，创建并执行线程。这里还包括了 getTask() 方法，也就是从队列中不断的获取未被执行的线程。
* 好，那么以上呢，就是这个简单线程池实现的具体体现。但如果深思熟虑就会发现这里需要很多完善，比如：线程池状态呢，不可能一直奔跑呀！？、线程池的锁呢，不会有并发问题吗？、线程池拒绝后的策略呢？，这些问题都没有在主流程解决，也正因为没有这些流程，所以上面的代码才更容易理解。

接下来，我们就开始分析线程池的源码，与我们实现的简单线程池参考对比，会更加容易理解😄！

---
### 线程池源码分析
#### 线程池类关系图
![pic](/java/thread/interview-21-2.png)
以围绕核心类 `ThreadPoolExecutor` 的实现展开的类之间实现和继承关系，如上图线程池类关系图。

* 接口 `Executor`、`ExecutorService`，定义线程池的基本方法。尤其是 `execute(Runnable command)` 提交线程池方法。
* 抽象类 `AbstractExecutorService`，实现了基本通用的接口方法。
* `ThreadPoolExecutor`，是整个线程池最核心的工具类方法，所有的其他类和接口，为围绕这个类来提供各自的功能。
* `Worker`，是任务类，也就是最终执行的线程的方法。
* `RejectedExecutionHandler`，是拒绝策略接口，有四个实现类；`AbortPolicy(抛异常方式拒绝)`、`DiscardPolicy(直接丢弃)`、`DiscardOldestPolicy(丢弃存活时间最长的任务)`、`CallerRunsPolicy(谁提交谁执行)`。
* `Executors`，是用于创建我们常用的不同策略的线程池，`newFixedThreadPool`、`newCachedThreadPool`、`newScheduledThreadPool`、`newSingleThreadExecutor`。

#### 高3位与低29位
![pic](/java/thread/interview-21-3.png)
```java
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
private static final int COUNT_BITS = Integer.SIZE - 3;
private static final int CAPACITY   = (1 << COUNT_BITS) - 1;

private static final int RUNNING    = -1 << COUNT_BITS;
private static final int SHUTDOWN   =  0 << COUNT_BITS;
private static final int STOP       =  1 << COUNT_BITS;
private static final int TIDYING    =  2 << COUNT_BITS;
private static final int TERMINATED =  3 << COUNT_BITS;
```
在 `ThreadPoolExecutor` 线程池实现类中，使用 `AtomicInteger` 类型的 `ctl` 记录线程池状态和线程池数量。在一个类型上记录多个值，它采用的分割数据区域，高3位记录线程池状态状态，低29位存储线程数量，默认 RUNNING 状态，线程数为0个。

---
#### 线程池状态
![pic](/java/thread/interview-21-4.png)
上图是线程池中的状态流转关系，包括如下状态：

* RUNNING：运行状态，接受新的任务并且处理队列中的任务。
* SHUTDOWN：关闭状态(调用了shutdown方法)。不接受新任务，,但是要处理队列中的任务。
* STOP：停止状态(调用了shutdownNow方法)。不接受新任务，也不处理队列中的任务，并且要中断正在处理的任务。
* TIDYING：所有的任务都已终止了，workerCount为0，线程池进入该状态后会调 terminated() 方法进入TERMINATED 状态。
* TERMINATED：终止状态，terminated() 方法调用结束后的状态。

---
#### 提交线程(execute)
![pic](/java/thread/interview-21-5.png)
```java
//这个就是我们指定的阻塞队列
private final BlockingQueue<Runnable> workQueue;

//再次提醒，这里没加锁！！该有什么意识不用我说了吧，所以说ctl才会使用原子类。
public void execute(Runnable command) {
    if (command == null)
        throw new NullPointerException();     //如果任务为null，那执行个寂寞，所以说直接空指针
    int c = ctl.get();      //获取ctl的值，一会要读取信息的
    if (workerCountOf(c) < corePoolSize) {   //判断工作线程数量是否小于核心线程数
        if (addWorker(command, true))    //如果是，那不管三七二十一，直接加新的线程执行，然后返回即可
            return;
        c = ctl.get();    //如果线程添加失败（有可能其他线程也在对线程池进行操作），那就更新一下c的值
    }
    if (isRunning(c) && workQueue.offer(command)) {   //继续判断，如果当前线程池是运行状态，那就尝试向阻塞队列中添加一个新的等待任务
        int recheck = ctl.get();   //再次获取ctl的值
        if (! isRunning(recheck) && remove(command))   //这里是再次确认当前线程池是否关闭，如果添加等待任务后线程池关闭了，那就把刚刚加进去任务的又拿出来
            reject(command);   //然后直接拒绝当前任务的提交（会根据我们的拒绝策略决定如何进行拒绝操作）
        else if (workerCountOf(recheck) == 0)   //如果这个时候线程池依然在运行状态，那么就检查一下当前工作线程数是否为0，如果是那就直接添加新线程执行
            addWorker(null, false);   //添加一个新的非核心线程，但是注意没添加任务
      	//其他情况就啥也不用做了
    }
    else if (!addWorker(command, false))   //这种情况要么就是线程池没有运行，要么就是队列满了，按照我们之前的规则，核心线程数已满且队列已满，那么会直接添加新的非核心线程，但是如果已经添加到最大数量，这里肯定是会失败的
        reject(command);   //确实装不下了，只能拒绝
}
```
在阅读这部分源码的时候，可以参考我们自己实现的线程池。其实最终的目的都是一样的，就是这段被提交的线程，`启动执行`、`加入队列`、`决策策略`，这三种方式。

* `ctl.get()`，取的是记录线程状态和线程个数的值，最终需要使用方法 `workerCountOf()`，来获取当前线程数量。`workerCountOf` 执行的是 `c & CAPACITY` 运算
* 根据当前线程池中线程数量，与核心线程数 `corePoolSize`做对比，小于则进行添加线程到任务执行队列。
* 如果说此时线程数已满，那么则需要判断线程池是否为运行状态 `isRunning(c)`。如果是运行状态则把不能被执行的线程放入线程队列中。
* 放入线程队列以后，还需要重新判断线程是否运行以及移除操作，如果非运行且移除，则进行拒绝策略。否则判断线程数量为0后添加新线程。
* 最后就是再次尝试添加任务执行，此时方法 `addWorker` 的第二个入参是 false，最终会影响添加执行任务数量判断。如果添加失败则进行拒绝策略。


---
#### 添加执行任务(addWorker)
![pic](/java/thread/interview-21-6.png)
```java
private boolean addWorker(Runnable firstTask, boolean core) {
	//增加线程数量
  	//这里给最外层循环打了个标签，方便一会的跳转操作
    retry:
    for (;;) {    //无限循环，老套路了，注意这里全程没加锁
        int c = ctl.get();     //获取ctl值
        int rs = runStateOf(c);    //解析当前的运行状态

        // Check if queue empty only if necessary.
        if (rs >= SHUTDOWN &&   //判断线程池是否不是处于运行状态
            ! (rs == SHUTDOWN &&   //如果不是运行状态，判断线程是SHUTDOWN状态并、任务不为null、等待队列不为空，只要有其中一者不满足，直接返回false，添加失败
               firstTask == null &&   
               ! workQueue.isEmpty()))
            return false;

        for (;;) {   //内层又一轮无限循环，这个循环是为了将线程计数增加，然后才可以真正地添加一个新的线程
            int wc = workerCountOf(c);    //解析当前的工作线程数量
            if (wc >= CAPACITY ||
                wc >= (core ? corePoolSize : maximumPoolSize))    //判断一下还装得下不，如果装得下，看看是核心线程还是非核心线程，如果是核心线程，不能大于核心线程数的限制，如果是非核心线程，不能大于最大线程数限制
                return false;
            if (compareAndIncrementWorkerCount(c))    //CAS自增线程计数，如果增加成功，任务完成，直接跳出继续
                break retry;    //注意这里要直接跳出最外层循环，所以用到了标签（类似于goto语句）
            c = ctl.get();  // 如果CAS失败，更新一下c的值
            if (runStateOf(c) != rs)    //如果CAS失败的原因是因为线程池状态和一开始的不一样了，那么就重新从外层循环再来一次
                continue retry;    //注意这里要直接从最外层循环继续，所以用到了标签（类似于goto语句）
            // 如果是其他原因导致的CAS失败，那只可能是其他线程同时在自增，所以重新再来一次内层循环
        }
    }

    //创建启动线程
  	//好了，线程计数自增也完了，接着就是添加新的工作线程了
    boolean workerStarted = false;   //工作线程是否已启动
    boolean workerAdded = false;    //工作线程是否已添加
    Worker w = null;     //暂时理解为工作线程，别急，我们之后会解读Worker类
    try {
        w = new Worker(firstTask);     //创建新的工作线程，传入我们提交的任务
        final Thread t = w.thread;    //拿到工作线程中封装的Thread对象
        if (t != null) {      //如果线程不为null，那就可以安排干活了
            final ReentrantLock mainLock = this.mainLock;      //又是ReentrantLock加锁环节，这里开始就是只有一个线程能进入了
            mainLock.lock();
            try {
                // Recheck while holding lock.
                // Back out on ThreadFactory failure or if
                // shut down before lock acquired.
                int rs = runStateOf(ctl.get());    //获取当前线程的运行状态

                if (rs < SHUTDOWN ||
                    (rs == SHUTDOWN && firstTask == null)) {    //只有当前线程池是正在运行状态，或是SHUTDOWN状态且firstTask为空，那么就继续
                    if (t.isAlive()) // 检查一下线程是否正在运行状态
                        throw new IllegalThreadStateException();   //如果是那肯定是不能运行我们的任务的
                    workers.add(w);    //直接将新创建的Work丢进 workers 集合中
                    int s = workers.size();   //看看当前workers的大小
                    if (s > largestPoolSize)   //这里是记录线程池运行以来，历史上的最多线程数
                        largestPoolSize = s;
                    workerAdded = true;   //工作线程已添加
                }
            } finally {
                mainLock.unlock();   //解锁
            }
            if (workerAdded) {
                t.start();   //启动线程
                workerStarted = true;  //工作线程已启动
            }
        }
    } finally {
        if (! workerStarted)    //如果线程在上面的启动过程中失败了
            addWorkerFailed(w);    //将w移出workers并将计数器-1，最后如果线程池是终止状态，会尝试加速终止线程池
    }
    return workerStarted;   //返回是否成功
}
```
添加执行任务的流程可以分为两块看，上面代码部分是用于记录线程数量、下面代码部分是在独占锁里创建执行线程并启动。这部分代码在不看锁、CAS等操作的情况下，那么就和我们最开始手写的线程池基本一样了

* `if (rs >= SHUTDOWN &&! (rs == SHUTDOWN &&firstTask == null &&! workQueue.isEmpty()))`，判断当前线程池状态，是否为 `SHUTDOWN`、`STOP`、`TIDYING`、`TERMINATED`中的一个。并且当前状态为 `SHUTDOWN`、且传入的任务为 null，同时队列不为空。那么就返回 false。
* `compareAndIncrementWorkerCount`，CAS 操作，增加线程数量，成功就会跳出标记的循环体。
* `runStateOf(c) != rs`，最后是线程池状态判断，决定是否循环。
* 在线程池数量记录成功后，则需要进入加锁环节，创建执行线程，并记录状态。在最后如果判断没有启动成功，则需要执行 `addWorkerFailed` 方法，剔除到线程方法等操作。

---
#### Worker  
它继承自AbstractQueuedSynchronizer，时隔两章，居然再次遇到AQS，那也就是说，它本身就是一把锁：
```java
private final class Worker
    extends AbstractQueuedSynchronizer
    implements Runnable {
    //用来干活的线程
    final Thread thread;
    //要执行的第一个任务，构造时就确定了的
    Runnable firstTask;
    //干活数量计数器，也就是这个线程完成了多少个任务
    volatile long completedTasks;

    Worker(Runnable firstTask) {
        setState(-1); // 执行Task之前不让中断，将AQS的state设定为-1
        this.firstTask = firstTask;
        this.thread = getThreadFactory().newThread(this);   //通过预定义或是我们自定义的线程工厂创建线程
    }
  
    public void run() {
        runWorker(this);   //真正开始干活，包括当前活干完了又要等新的活来，就从这里开始，一会详细介绍
    }

   	//0就是没加锁，1就是已加锁
    protected boolean isHeldExclusively() {
        return getState() != 0;
    }

    ...
}
```
最后我们来看看一个Worker到底是怎么在进行任务的：

---
#### 执行线程(runWorker)
```java
final void runWorker(Worker w) {
    Thread wt = Thread.currentThread();   //获取当前线程
    Runnable task = w.firstTask;    //取出要执行的任务
    w.firstTask = null;   //然后把Worker中的任务设定为null
    w.unlock(); // 因为一开始为-1，这里是通过unlock操作将其修改回0，只有state大于等于0才能响应中断
    boolean completedAbruptly = true;
    try {
      	//只要任务不为null，或是任务为空但是可以从等待队列中取出任务不为空，那么就开始执行这个任务，注意这里是无限循环，也就是说如果当前没有任务了，那么会在getTask方法中卡住，因为要从阻塞队列中等着取任务
        while (task != null || (task = getTask()) != null) {
            w.lock();    //对当前Worker加锁，这里其实并不是防其他线程，而是在shutdown时保护此任务的运行
            
          //由于线程池在STOP状态及以上会禁止新线程加入并且中断正在进行的线程
            if ((runStateAtLeast(ctl.get(), STOP) ||   //只要线程池是STOP及以上的状态，那肯定是不能开始新任务的
                 (Thread.interrupted() &&    					 //线程是否已经被打上中断标记并且线程一定是STOP及以上
                  runStateAtLeast(ctl.get(), STOP))) &&
                !wt.isInterrupted())   //再次确保线程被没有打上中断标记
                wt.interrupt();     //打中断标记
            try {
                beforeExecute(wt, task);  //开始之前的准备工作，这里暂时没有实现
                Throwable thrown = null;
                try {
                    task.run();    //OK，开始执行任务
                } catch (RuntimeException x) {
                    thrown = x; throw x;
                } catch (Error x) {
                    thrown = x; throw x;
                } catch (Throwable x) {
                    thrown = x; throw new Error(x);
                } finally {
                    afterExecute(task, thrown);    //执行之后的工作，也没实现
                }
            } finally {
                task = null;    //任务已完成，不需要了
                w.completedTasks++;   //任务完成数++
                w.unlock();    //解锁
            }
        }
        completedAbruptly = false;
    } finally {
      	//如果能走到这一步，那说明上面的循环肯定是跳出了，也就是说这个Worker可以丢弃了
      	//所以这里会直接将 Worker 从 workers 里删除掉
        processWorkerExit(w, completedAbruptly);
    }
}
```
其实，有了手写线程池的基础，到这也就基本了解了，线程池在干嘛。到这最核心的点就是 task.run() 让线程跑起来。额外再附带一些其他流程如下；

* beforeExecute、afterExecute，线程执行的前后做一些统计信息。
* 另外这里的锁操作是 Worker 继承 AQS 自己实现的不可重入的独占锁。
* processWorkerExit，如果你感兴趣，类似这样的方法也可以深入了解下。在线程退出时候workers做到一些移除处理以及完成任务数等，也非常有意思

那么它是怎么从阻塞队列里面获取任务的呢：

---
#### 队列获取任务(getTask)
如果你已经开始阅读源码，可以在 runWorker 方法中，看到这样一句循环代码 while (task != null || (task = getTask()) != null)。这与我们手写线程池中操作的方式是一样的，核心目的就是从队列中获取线程方法。  
  

```java
private Runnable getTask() {
    boolean timedOut = false; // Did the last poll() time out?

    for (;;) {    //无限循环获取
        int c = ctl.get();   //获取ctl 
        int rs = runStateOf(c);      //解析线程池运行状态

        // Check if queue empty only if necessary.
        if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {      //判断是不是没有必要再执行等待队列中的任务了，也就是处于关闭线程池的状态了
            decrementWorkerCount();     //直接减少一个工作线程数量
            return null;    //返回null，这样上面的runWorker就直接结束了，下同
        }

        int wc = workerCountOf(c);   //如果线程池运行正常，那就获取当前的工作线程数量

        // Are workers subject to culling?
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;   //如果线程数大于核心线程数或是允许核心线程等待超时，那么就标记为可超时的

      	//超时或maximumPoolSize在运行期间被修改了，并且线程数大于1或等待队列为空，那也是不能获取到任务的
        if ((wc > maximumPoolSize || (timed && timedOut))
            && (wc > 1 || workQueue.isEmpty())) {
            if (compareAndDecrementWorkerCount(c))   //如果CAS减少工作线程成功
                return null;    //返回null
            continue;   //否则开下一轮循环
        }

        try {
            Runnable r = timed ?
                workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :   //如果可超时，那么最多等到超时时间
                workQueue.take();    //如果不可超时，那就一直等着拿任务
            if (r != null)    //如果成功拿到任务，ok，返回
                return r;
            timedOut = true;   //否则就是超时了，下一轮循环将直接返回null
        } catch (InterruptedException retry) {
            timedOut = false;
        }
      	//开下一轮循环吧
    }
}
```
* getTask 方法从阻塞队列中获取等待被执行的任务，也就是一条条往出拿线程方法。
* if (rs >= SHUTDOWN ...，判断线程是否关闭。
* wc = workerCountOf(c)，wc > corePoolSize，如果工作线程数超过核心线程数量 corePoolSize 并且 workQueue 不为空，则增加工作线程。但如果超时未获取到线程，则会把大于 corePoolSize 的线程销毁掉。
* timed，是 allowCoreThreadTimeOut 得来的。最终 timed 为 true 时，则通过阻塞队列的poll方法进行超时控制。
* 如果在 keepAliveTime 时间内没有获取到任务，则返回null。如果为false，则阻塞。

虽然我们的源码解读越来越深，但是只要各位的思路不断，依然是可以继续往下看的。到此，有关execute()方法的源码解读，就先到这里。

接着我们来看当线程池关闭时会做什么事情：
### 线程池关闭
```java
//普通的shutdown会继续将等待队列中的线程执行完成后再关闭线程池
public void shutdown() {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
      	//判断是否有权限终止
        checkShutdownAccess();
      	//CAS将线程池运行状态改为SHUTDOWN状态，还算比较温柔，详细过程看下面
        advanceRunState(SHUTDOWN);
       	//让闲着的线程（比如正在等新的任务）中断，但是并不会影响正在运行的线程，详细过程请看下面
        interruptIdleWorkers();
        onShutdown(); //给ScheduledThreadPoolExecutor提供的钩子方法，就是等ScheduledThreadPoolExecutor去实现的，当前类没有实现
    } finally {
        mainLock.unlock();
    }
    tryTerminate();   //最后尝试终止线程池
}
```

```java
private void advanceRunState(int targetState) {
    for (;;) {
        int c = ctl.get();    //获取ctl
        if (runStateAtLeast(c, targetState) ||    //是否大于等于指定的状态
            ctl.compareAndSet(c, ctlOf(targetState, workerCountOf(c))))   //CAS设置ctl的值
            break;   //任意一个条件OK就可以结束了
    }
}
```

```java
private void interruptIdleWorkers(boolean onlyOne) {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        for (Worker w : workers) {
            Thread t = w.thread;    //拿到Worker中的线程
            if (!t.isInterrupted() && w.tryLock()) {   //先判断一下线程是不是没有被中断然后尝试加锁，但是通过前面的runWorker()源代码我们得知，开始之后是让Worker加了锁的，所以如果线程还在执行任务，那么这里肯定会false
                try {
                    t.interrupt();    //如果走到这里，那么说明线程肯定是一个闲着的线程，直接给中断吧
                } catch (SecurityException ignore) {
                } finally {
                    w.unlock();    //解锁
                }
            }
            if (onlyOne)   //如果只针对一个Worker，那么就结束循环
                break;
        }
    } finally {
        mainLock.unlock();
    }
}
```

而shutdownNow()方法也差不多，但是这里会更直接一些：
```java
//shutdownNow开始后，不仅不允许新的任务到来，也不会再执行等待队列的线程，而且会终止正在执行的线程
public List<Runnable> shutdownNow() {
    List<Runnable> tasks;
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        checkShutdownAccess();
      	//这里就是直接设定为STOP状态了，不再像shutdown那么温柔
        advanceRunState(STOP);
      	//直接中断所有工作线程，详细过程看下面
        interruptWorkers();
      	//取出仍处于阻塞队列中的线程
        tasks = drainQueue();
    } finally {
        mainLock.unlock();
    }
    tryTerminate();
    return tasks;   //最后返回还没开始的任务
}
```

```java
private void interruptWorkers() {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        for (Worker w : workers)   //遍历所有Worker
            w.interruptIfStarted();   //无差别对待，一律加中断标记
    } finally {
        mainLock.unlock();
    }
}
```

最后的最后，我们再来看看tryTerminate()是怎么完完全全终止掉一个线程池的：
```java
final void tryTerminate() {
    for (;;) {     //无限循环
        int c = ctl.get();    //上来先获取一下ctl值
      	//只要是正在运行 或是 线程池基本上关闭了 或是 处于SHUTDOWN状态且工作队列不为空，那么这时还不能关闭线程池，返回
        if (isRunning(c) ||
            runStateAtLeast(c, TIDYING) ||
            (runStateOf(c) == SHUTDOWN && ! workQueue.isEmpty()))
            return;
      
      	//走到这里，要么处于SHUTDOWN状态且等待队列为空或是STOP状态
        if (workerCountOf(c) != 0) { // 如果工作线程数不是0，这里也会中断空闲状态下的线程
            interruptIdleWorkers(ONLY_ONE);   //这里最多只中断一个空闲线程，然后返回
            return;
        }

      	//走到这里，工作线程也为空了，可以终止线程池了
        final ReentrantLock mainLock = this.mainLock;
        mainLock.lock();
        try {
            if (ctl.compareAndSet(c, ctlOf(TIDYING, 0))) {   //先CAS将状态设定为TIDYING表示基本终止，正在做最后的操作
                try {
                    terminated();   //终止，暂时没有实现
                } finally {
                    ctl.set(ctlOf(TERMINATED, 0));   //最后将状态设定为TERMINATED，线程池结束了它年轻的生命
                    termination.signalAll();    //如果有线程调用了awaitTermination方法，会等待当前线程池终止，到这里差不多就可以唤醒了
                }
                return;   //结束
            }
          	//注意如果CAS失败会直接进下一轮循环重新判断
        } finally {
            mainLock.unlock();
        }
        // else retry on failed CAS
    }
}
```

### 总结
* 这一章节并没有完全把线程池的所有知识点都介绍完，否则一篇内容会有些臃肿。在这一章节我们从手写线程池开始，逐步的分析这些代码在Java的线程池中是如何实现的，涉及到的知识点也几乎是我们以前介绍过的内容，包括：队列、CAS、AQS、重入锁、独占锁等内容。所以这些知识也基本是环环相扣的，最好有一些根基否则会有些不好理解。
* 除了本章介绍的，我们还没有讲到四种线程池方法的选择和使用、以及在CPU密集型任务、IO 密集型任务时该怎么配置。另外在Spring中也有自己实现的线程池方法。这些知识点都非常贴近实际操作。
* 好了，今天的内容先扯到这，后续的内容陆续完善。如果以上内容有错字、流程缺失、或者不好理解以及描述错误，欢迎留言。互相学习、互相进步。

---
---
## 线程池的介绍和使用，以及基于jvmti设计非入侵监控
### 四种线程池使用介绍
`Executors `是创建线程池的工具类，比较典型常见的四种线程池包括：`newFixedThreadPool`、`newSingleThreadExecutor`、`newCachedThreadPool`、`newScheduledThreadPool`。每一种都有自己特定的典型例子，可以按照每种的特性用在不同的业务场景，也可以做为参照精细化创建线程池。  

#### newFixedThreadPool
```java
public static void main(String[] args) {
    ExecutorService executorService = Executors.newFixedThreadPool(3);
    for (int i = 1; i < 5; i++) {
        int groupId = i;
        executorService.execute(() -> {
            for (int j = 1; j < 5; j++) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignored) {
                }
                logger.info("第 {} 组任务，第 {} 次执行完成", groupId, j);
            }
        });
    }
    executorService.shutdown();
}

// 测试结果
23:48:24.628 [pool-2-thread-1] INFO  o.i.i.test.Test_newFixedThreadPool - 第 1 组任务，第 1 次执行完成
23:48:24.628 [pool-2-thread-2] INFO  o.i.i.test.Test_newFixedThreadPool - 第 2 组任务，第 1 次执行完成
23:48:24.628 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 3 组任务，第 1 次执行完成
23:48:25.633 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 3 组任务，第 2 次执行完成
23:48:25.633 [pool-2-thread-1] INFO  o.i.i.test.Test_newFixedThreadPool - 第 1 组任务，第 2 次执行完成
23:48:25.633 [pool-2-thread-2] INFO  o.i.i.test.Test_newFixedThreadPool - 第 2 组任务，第 2 次执行完成
23:48:26.633 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 3 组任务，第 3 次执行完成
23:48:26.633 [pool-2-thread-2] INFO  o.i.i.test.Test_newFixedThreadPool - 第 2 组任务，第 3 次执行完成
23:48:26.633 [pool-2-thread-1] INFO  o.i.i.test.Test_newFixedThreadPool - 第 1 组任务，第 3 次执行完成
23:48:27.634 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 3 组任务，第 4 次执行完成
23:48:27.634 [pool-2-thread-2] INFO  o.i.i.test.Test_newFixedThreadPool - 第 2 组任务，第 4 次执行完成
23:48:27.634 [pool-2-thread-1] INFO  o.i.i.test.Test_newFixedThreadPool - 第 1 组任务，第 4 次执行完成
23:48:28.635 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 4 组任务，第 1 次执行完成
23:48:29.635 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 4 组任务，第 2 次执行完成
23:48:30.635 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 4 组任务，第 3 次执行完成
23:48:31.636 [pool-2-thread-3] INFO  o.i.i.test.Test_newFixedThreadPool - 第 4 组任务，第 4 次执行完成

Process finished with exit code 0
```
图解
![pic](/java/thread/interview-22-1.png)
* 代码：`new ThreadPoolExecutor(nThreads, nThreads, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<Runnable>())`
* 介绍：创建一个固定大小可重复使用的线程池，以 LinkedBlockingQueue 无界阻塞队列存放等待线程。
* 风险：随着线程任务不能被执行的的无限堆积，可能会导致OOM。

---
#### newSingleThreadExecutor
```java
public static void main(String[] args) {
    ExecutorService executorService = Executors.newSingleThreadExecutor();
    for (int i = 1; i < 5; i++) {
        int groupId = i;
        executorService.execute(() -> {
            for (int j = 1; j < 5; j++) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignored) {
                }
                logger.info("第 {} 组任务，第 {} 次执行完成", groupId, j);
            }
        });
    }
    executorService.shutdown();
}

// 测试结果
23:20:15.066 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 1 组任务，第 1 次执行完成
23:20:16.069 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 1 组任务，第 2 次执行完成
23:20:17.070 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 1 组任务，第 3 次执行完成
23:20:18.070 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 1 组任务，第 4 次执行完成
23:20:19.071 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 2 组任务，第 1 次执行完成
23:23:280.071 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 2 组任务，第 2 次执行完成
23:23:281.072 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 2 组任务，第 3 次执行完成
23:23:282.072 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 2 组任务，第 4 次执行完成
23:23:283.073 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 3 组任务，第 1 次执行完成
23:23:284.074 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 3 组任务，第 2 次执行完成
23:23:285.074 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 3 组任务，第 3 次执行完成
23:23:286.075 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 3 组任务，第 4 次执行完成
23:23:287.075 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 4 组任务，第 1 次执行完成
23:23:288.075 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 4 组任务，第 2 次执行完成
23:23:289.076 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 4 组任务，第 3 次执行完成
23:20:30.076 [pool-2-thread-1] INFO  o.i.i.t.Test_newSingleThreadExecutor - 第 4 组任务，第 4 次执行完成
```
图解
![pic](/java/thread/interview-22-2.png)
* 代码：`new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<Runnable>())`
* 介绍：只创建一个执行线程任务的线程池，如果出现意外终止则再创建一个。
* 风险：同样这也是一个无界队列存放待执行线程，无限堆积下会出现OOM。

---
#### newCachedThreadPool
```java
public static void main(String[] args) throws InterruptedException {
    ExecutorService executorService = Executors.newCachedThreadPool();
    for (int i = 1; i < 5; i++) {
        int groupId = i;
        executorService.execute(() -> {
            for (int j = 1; j < 5; j++) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignored) {
                }
                logger.info("第 {} 组任务，第 {} 次执行完成", groupId, j);
            }
        });
    }
    executorService.shutdown();
    
    // 测试结果
    23:25:59.818 [pool-2-thread-2] INFO  o.i.i.test.Test_newCachedThreadPool - 第 2 组任务，第 1 次执行完成
    23:25:59.818 [pool-2-thread-3] INFO  o.i.i.test.Test_newCachedThreadPool - 第 3 组任务，第 1 次执行完成
    23:25:59.818 [pool-2-thread-1] INFO  o.i.i.test.Test_newCachedThreadPool - 第 1 组任务，第 1 次执行完成
    23:25:59.818 [pool-2-thread-4] INFO  o.i.i.test.Test_newCachedThreadPool - 第 4 组任务，第 1 次执行完成
    23:25:00.823 [pool-2-thread-4] INFO  o.i.i.test.Test_newCachedThreadPool - 第 4 组任务，第 2 次执行完成
    23:25:00.823 [pool-2-thread-1] INFO  o.i.i.test.Test_newCachedThreadPool - 第 1 组任务，第 2 次执行完成
    23:25:00.823 [pool-2-thread-2] INFO  o.i.i.test.Test_newCachedThreadPool - 第 2 组任务，第 2 次执行完成
    23:25:00.823 [pool-2-thread-3] INFO  o.i.i.test.Test_newCachedThreadPool - 第 3 组任务，第 2 次执行完成
    23:25:01.823 [pool-2-thread-4] INFO  o.i.i.test.Test_newCachedThreadPool - 第 4 组任务，第 3 次执行完成
    23:25:01.823 [pool-2-thread-1] INFO  o.i.i.test.Test_newCachedThreadPool - 第 1 组任务，第 3 次执行完成
    23:25:01.824 [pool-2-thread-2] INFO  o.i.i.test.Test_newCachedThreadPool - 第 2 组任务，第 3 次执行完成
    23:25:01.824 [pool-2-thread-3] INFO  o.i.i.test.Test_newCachedThreadPool - 第 3 组任务，第 3 次执行完成
    23:25:02.824 [pool-2-thread-1] INFO  o.i.i.test.Test_newCachedThreadPool - 第 1 组任务，第 4 次执行完成
    23:25:02.824 [pool-2-thread-4] INFO  o.i.i.test.Test_newCachedThreadPool - 第 4 组任务，第 4 次执行完成
    23:25:02.825 [pool-2-thread-3] INFO  o.i.i.test.Test_newCachedThreadPool - 第 3 组任务，第 4 次执行完成
    23:25:02.825 [pool-2-thread-2] INFO  o.i.i.test.Test_newCachedThreadPool - 第 2 组任务，第 4 次执行完成
}
```
图解
![pic](/java/thread/interview-22-3.png)
* 代码：`new ThreadPoolExecutor(0, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS, new SynchronousQueue<Runnable>())`
* 介绍：首先 SynchronousQueue 是一个生产消费模式的阻塞任务队列，只要有任务就需要有线程执行，线程池中的线程可以重复使用。
* 风险：如果线程任务比较耗时，又大量创建，会导致OOM

---
#### newScheduledThreadPool
```java
public static void main(String[] args) {
    ScheduledExecutorService executorService = Executors.newScheduledThreadPool(1);
    executorService.schedule(() -> {
        logger.info("3秒后开始执行");
    }, 3, TimeUnit.SECONDS);
    executorService.scheduleAtFixedRate(() -> {
        logger.info("3秒后开始执行，以后每2秒执行一次");
    }, 3, 2, TimeUnit.SECONDS);
    executorService.scheduleWithFixedDelay(() -> {
        logger.info("3秒后开始执行，后续延迟2秒");
    }, 3, 2, TimeUnit.SECONDS);
}

// 测试结果
23:28:32.442 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行
23:28:32.444 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行，以后每2秒执行一次
23:28:32.444 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行，后续延迟2秒
23:28:34.441 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行，以后每2秒执行一次
23:28:34.445 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行，后续延迟2秒
23:28:36.440 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行，以后每2秒执行一次
23:28:36.445 [pool-2-thread-1] INFO  o.i.i.t.Test_newScheduledThreadPool - 3秒后开始执行，后续延迟2秒
```
图解
![pic](/java/thread/interview-22-4.png)
* 代码：`public ScheduledThreadPoolExecutor(int corePoolSize) { super(corePoolSize, Integer.MAX_VALUE, 0, NANOSECONDS, new ScheduledThreadPoolExecutor.DelayedWorkQueue()); }`
* 介绍：这就是一个比较有意思的线程池了，它可以延迟定时执行，有点像我们的定时任务。同样它也是一个无限大小的线程池 Integer.MAX_VALUE。它提供的调用方法比较多，包括：scheduleAtFixedRate、scheduleWithFixedDelay，可以按需选择延迟执行方式。
* 风险：同样由于这是一组无限容量的线程池，所以依旧有OOM风险。

---
### 线程池使用场景说明
什么时候使用线程池？

说简单是当为了给老板省钱的时候，因为使用线程池可以降低服务器资源的投入，让每台机器尽可能更大限度的使用CPU。

😄那你这么说肯定没办法升职加薪了！

所以如果说的高大上一点，那么是在符合科特尔法则 (opens new window)和阿姆达尔定律  (opens new window)的情况下，引入线程池的使用最为合理。啥意思呢，还得简单说！

假如：我们有一套电商服务，用户浏览商品的并发访问速率是：1000客户/每分钟，平均每个客户在服务器上的耗时0.5分钟。根据利特尔法则，在任何时刻，服务端都承担着1000×0.5=500个客户的业务处理量。过段时间大促了，并发访问的用户扩了一倍2000客户了，那怎么保障服务性能呢？

1. 提高服务器并发处理的业务量，即提高到2000×0.5=1000
2. 减少服务器平均处理客户请求的时间，即减少到：2000×0.25=500
所以：在有些场景下会把串行的请求接口，压缩成并行执行，如下图
![pic](/java/thread/interview-22-5.png)
但是，线程池的使用会随着业务场景变化而不同，如果你的业务需要大量的使用线程池，并非常依赖线程池，那么就不可能用 Executors 工具类中提供的方法。因为这些线程池的创建都不够精细化，也非常容易造成OOM风险，而且随着业务场景逻辑不同，会有IO密集型和CPU密集型。

最终，大家使用的线程池都是使用 new ThreadPoolExecutor() 创建的，当然也有基于Spring的线程池配置 org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor。

可你想过吗，同样一个接口在有活动时候怎么办、有大促时候怎么办，可能你当时设置的线程池是合理的，但是一到流量非常大的时候就很不适合了，所以如果能动态调整线程池就非常有必要了。而且使用 new ThreadPoolExecutor() 方式创建的线程池是可以通过提供的 set 方法进行动态调整的。有了这个动态调整的方法后，就可以把线程池包装起来，在配合动态调整的页面，动态更新线程池参数，就可以非常方便的调整线程池了。

---
### 获取线程池监控信息
可监控内容
|方法|含义|
|----|:---:|---:|
|getActiveCount()	|线程池中正在执行任务的线程数量|
|getCompletedTaskCount()	|线程池已完成的任务数量，该值小于等于taskCount|
|getCorePoolSize()	|线程池的核心线程数量|
|getLargestPoolSize()	|线程池曾经创建过的最大线程数量。通过这个数据可以知道线程池是否满过，也就是达到了maximumPoolSize|
|getMaximumPoolSize()	|线程池的最大线程数量|
|getPoolSize()	|线程池当前的线程数量|
|getTaskCount()	|线程池已经执行的和未执行的任务总数|

#### 重写线程池方式监控
如果我们想监控一个线程池的方法执行动作，最简单的方式就是继承这个类，重写方法，在方法中添加动作收集信息。
伪代码
```java
public class ThreadPoolMonitor extends ThreadPoolExecutor {

    @Override
    public void shutdown() {
        // 统计已执行任务、正在执行任务、未执行任务数量
        super.shutdown();
    }

    @Override
    public List<Runnable> shutdownNow() {
        // 统计已执行任务、正在执行任务、未执行任务数量
        return super.shutdownNow();
    }

    @Override
    protected void beforeExecute(Thread t, Runnable r) {
        // 记录开始时间
    }

    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        // 记录完成耗时
    }
    
    ...
}

```

---
#### 基于JVMTI方式监控
这块是监控的重点，因为我们不太可能让每一个需要监控的线程池都来重写的方式记录，这样的改造成本太高了。

那么除了这个笨方法外，可以选择使用基于JVMTI的方式，进行开发监控组件。

JVMTI：JVMTI(JVM Tool Interface)位于jpda最底层，是Java虚拟机所提供的native编程接口。JVMTI可以提供性能分析、debug、内存管理、线程分析等功能。

基于jvmti提供的接口服务，运用C++代码(win32-add_library)在Agent_OnLoad里开发监控服务，并生成dll文件。开发完成后在java代码中加入agentpath，这样就可以监控到我们需要的信息内容。
[这个太高级了，暂时没学明白，详情点此看](http://s.xiaoyuan.space/30yVRl)

---
#### 基于中间件的监控
马哥的hippo4j 开源组件，可以用于学习
● GitHub：https://github.com/opengoofy/hippo4j
● Gitee：https://gitee.com/opengoofy/hippo4j