# Thread
## start() ，它是怎么让线程启动的呢？
### 线程启动分析
```java
new Thread(() -> {
    // todo
}).start();
```
咳咳，Java 的线程创建和启动非常简单，但如果问一个线程是怎么启动起来的往往并不清楚，甚至不知道为什么启动时是调用```start()```，而不是调用```run()```方法呢？

那么，为了让大家有一个更直观的认知，我们先站在上帝视角。把这段 Java 的线程代码，到 JDK 方法使用，以及 JVM 的相应处理过程，展示给大家，以方便我们后续逐步分析。
![pic](/java/thread/interview-19-1.png)
以上，就是一个线程启动的整体过程分析，会涉及到如下知识点：

* 线程的启动会涉及到本地方法（JNI）的调用，也就是那部分 C++ 编写的代码。
* JVM 的实现中会有不同操作系统对线程的统一处理，比如：Win、Linux、Unix。
* 线程的启动会涉及到线程的生命周期状态（RUNNABLE），以及唤醒操作，所以最终会有回调操作。也就是调用我们的 run() 方法
* **所以调用run()方法只是会在当前线程执行，而不是启动一个新线程来执行。而start()方法则会新建一个线程，再回调run()方法。**
* 接下来，我们就开始逐步分析每一步源码的执行内容，从而了解线程启动过程。

### 线程启动过程
#### Thread start UML 图
![pic](/java/thread/interview-19-2.png)  
如图 19-2 是线程的启动过程时序图，整体的链路较长，会涉及到 JVM 的操作。
> 核心源码如下：  
Thread.c：https://github.com/unofficial-openjdk/openjdk/blob/jdk/jdk/src/java.base/share/native/libjava/Thread.c
jvm.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/prims/jvm.cpp
thread.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/thread.cpp
os.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/os.hpp
os_linux.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/os/linux/vm/os_linux.cpp
os_windows.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/os/windows/vm/os_windows.cpp
vmSymbols.hpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/classfile/vmSymbols.hpp

#### Java 层面 Thread 启动
##### start() 方法
```java
new Thread(() -> {
    // todo
}).start();

// JDK 源码
public synchronized void start() {

    if (threadStatus != 0)
        throw new IllegalThreadStateException();

    group.add(this);
    boolean started = false;
    try {
        start0();
        started = true;
    } finally {
        try {
            if (!started) {
                group.threadStartFailed(this);
            }
        } catch (Throwable ignore) {}
    }
}
```
* 线程启动方法 start()，在它的方法英文注释中已经把核心内容描述出来。Causes this thread to begin execution; the Java Virtual Machine calls the run method of this thread. 这段话的意思是：由 JVM 调用此线程的 run 方法，使线程开始执行。其实这就是一个 JVM 的回调过程，下文源码分析中会讲到
* 另外 start() 是一个 synchronized 方法，但为了避免多次调用，在方法中会由线程状态判断。threadStatus != 0。
* group.add(this)，是把当前线程加入到线程组，ThreadGroup。
* start0()，是一个本地方法，通过 JNI 方式调用执行。这一步的操作才是启动线程的核心步骤。

---
##### start0() 本地方法
```java
// 本地方法 start0
private native void start0();

// 注册本地方法
public class Thread implements Runnable {
    /* Make sure registerNatives is the first thing <clinit> does. */
    private static native void registerNatives();
    static {
        registerNatives();
    }
    // ...
}    
```
* ```start0()```，是一个本地方法，用于启动线程。
* `registerNatives()`，这个方法是用于注册线程执行过程中需要的一些本地方法，比如：start0、isAlive、yield、sleep、interrupt0等。  

registerNatives，本地方法定义在 Thread.c 中，以下是定义的核心源码：
```c
static JNINativeMethod methods[] = {
    {"start0",           "()V",        (void *)&JVM_StartThread},
    {"stop0",            "(" OBJ ")V", (void *)&JVM_StopThread},
    {"isAlive",          "()Z",        (void *)&JVM_IsThreadAlive},
    {"suspend0",         "()V",        (void *)&JVM_SuspendThread},
    {"resume0",          "()V",        (void *)&JVM_ResumeThread},
    {"setPriority0",     "(I)V",       (void *)&JVM_SetThreadPriority},
    {"yield",            "()V",        (void *)&JVM_Yield},
    {"sleep",            "(J)V",       (void *)&JVM_Sleep},
    {"currentThread",    "()" THD,     (void *)&JVM_CurrentThread},
    {"interrupt0",       "()V",        (void *)&JVM_Interrupt},
    {"holdsLock",        "(" OBJ ")Z", (void *)&JVM_HoldsLock},
    {"getThreads",        "()[" THD,   (void *)&JVM_GetAllThreads},
    {"dumpThreads",      "([" THD ")[[" STE, (void *)&JVM_DumpThreads},
    {"setNativeName",    "(" STR ")V", (void *)&JVM_SetNativeThreadName},
};
```
* 源码：https://github.com/unofficial-openjdk/openjdk/blob/jdk/jdk/src/java.base/share/native/libjava/Thread.c
* 从定义中可以看到，start0 方法会执行 &JVM_StartThread 方法，最终由 JVM 层面启动线程。

#### JVM 创建线程
##### JVM_StartThread
```cpp
//源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/prims/jvm.cpp
JVM_ENTRY(void, JVM_StartThread(JNIEnv* env, jobject jthread))
  JVMWrapper("JVM_StartThread");
  JavaThread *native_thread = NULL;
  
  // 创建线程
  native_thread = new JavaThread(&thread_entry, sz);
  // 启动线程
  Thread::start(native_thread);

JVM_END
```
* 这部分代码比较多，但核心内容主要是创建线程和启动线程，另外 &thread_entry 也是一个方法，如下：
thread_entry，线程入口
```cpp
static void thread_entry(JavaThread* thread, TRAPS) {
  HandleMark hm(THREAD);
  Handle obj(THREAD, thread->threadObj());
  JavaValue result(T_VOID);
  JavaCalls::call_virtual(&result,
                          obj,
                          KlassHandle(THREAD, SystemDictionary::Thread_klass()),
                          vmSymbols::run_method_name(),
                          vmSymbols::void_method_signature(),
                          THREAD);
}
```
* 重点，在创建线程引入这个线程入口的方法时，thread_entry 中包括了 Java 的回调函数 JavaCalls::call_virtual。这个回调函数会由 JVM 调用。
vmSymbols::run_method_name()，就是那个被回调的方法，源码如下：
```cpp
//源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/classfile/vmSymbols.hpp
#define VM_SYMBOLS_DO(template, do_alias)
template(run_method_name, "run") 
```
* 这个 run 就是我们的 Java 程序中会被调用的 run 方法。接下来我们继续按照代码执行链路，寻找到这个被回调的方法在什么时候调用的。

---
##### JavaThread
```cpp
native_thread = new JavaThread(&thread_entry, sz);
```
接下来，我们继续看 `JavaThread` 的源码执行内容。

```cpp
//源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/thread.cpp
JavaThread::JavaThread(ThreadFunction entry_point, size_t stack_sz) :
  Thread()
#if INCLUDE_ALL_GCS
  , _satb_mark_queue(&_satb_mark_queue_set),
  _dirty_card_queue(&_dirty_card_queue_set)
#endif // INCLUDE_ALL_GCS
{
  if (TraceThreadEvents) {
    tty->print_cr("creating thread %p", this);
  }
  initialize();
  _jni_attach_state = _not_attaching_via_jni;
  set_entry_point(entry_point);
  // Create the native thread itself.
  // %note runtime_23
  os::ThreadType thr_type = os::java_thread;
  thr_type = entry_point == &compiler_thread_entry ? os::compiler_thread :os::java_thread;
  os::create_thread(this, thr_type, stack_sz);
}
```
* ThreadFunction entry_point，就是我们上面的 thread_entry 方法。
* size_t stack_sz，表示进程中已有的线程个数。
* 这两个参数，都会传递给 os::create_thread 方法，用于创建线程使用。

---
##### os::create_thread
* os_linux.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/os/linux/vm/os_linux.cpp
* os_windows.cpp：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/os/windows/vm/os_windows.cpp
众所周知，JVM 是个啥！，所以它的 OS 服务实现，Linux 还有 Windows 等，都会实现线程的创建逻辑。这有点像适配器模式
os_linux -> os::create_thread
```cpp
bool os::create_thread(Thread* thread, ThreadType thr_type, size_t stack_size) {
  assert(thread->osthread() == NULL, "caller responsible");

  // Allocate the OSThread object
  OSThread* osthread = new OSThread(NULL, NULL);
  // Initial state is ALLOCATED but not INITIALIZED
  osthread->set_state(ALLOCATED);
  
  pthread_t tid;
  int ret = pthread_create(&tid, &attr, (void* (*)(void*)) java_start, thread);

  return true;
}
```
* osthread->set_state(ALLOCATED)，初始化已分配的状态，但此时并没有初始化。
* pthread_create，是类Unix操作系统（Unix、Linux、Mac OS X等）的创建线程的函数。
* java_start，重点关注类，是实际创建线程的方法。

---
##### java_start
```cpp
// 源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/os/linux/vm/os_linux.cpp
static void *java_start(Thread *thread) {

  // 线程ID
  int pid = os::current_process_id();

  // 设置线程
  ThreadLocalStorage::set_thread(thread);

  // 设置线程状态：INITIALIZED 初始化完成
  osthread->set_state(INITIALIZED);
  
  // 唤醒所有线程
  sync->notify_all();

 // 循环，初始化状态，则一致等待 wait
 while (osthread->get_state() == INITIALIZED) {
    sync->wait(Mutex::_no_safepoint_check_flag);
 }

  // 等待唤醒后，执行 run 方法
  thread->run();

  return 0;
}
```
* JVM 设置线程状态，INITIALIZED 初始化完成。
* `sync->notify_all()`，唤醒所有线程。
* `osthread->get_state() == INITIALIZED`，while 循环等待
* `thread->run()`，是等待线程唤醒后，也就是状态变更后，才能执行到。这在我们的线程执行UML图中，也有所体现

#### JVM 启动线程
```cpp
JVM_ENTRY(void, JVM_StartThread(JNIEnv* env, jobject jthread))
  JVMWrapper("JVM_StartThread");
  JavaThread *native_thread = NULL;
  
  // 创建线程
  native_thread = new JavaThread(&thread_entry, sz);
  // 启动线程
  Thread::start(native_thread);

JVM_END
```
* JVM_StartThread 中有两步，创建（new JavaThread）、启动（Thread::start）。创建的过程聊完了，接下来我们聊启动。  

##### Thread::start
```java
//源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/thread.cpp
void Thread::start(Thread* thread) {
  trace("start", thread);

  if (!DisableStartThread) {
    if (thread->is_Java_thread()) {
      java_lang_Thread::set_thread_status(((JavaThread*)thread)->threadObj(),
                                          java_lang_Thread::RUNNABLE);
    }
    // 不同的 OS 会有不同的启动代码逻辑
    os::start_thread(thread);
  }
}
```
* 如果没有禁用线程 DisableStartThread 并且是 Java 线程 thread->is_Java_thread()，那么设置线程状态为 RUNNABLE。
* os::start_thread(thread)，调用线程启动方法。不同的 OS 会有不同的启动代码逻辑

---
##### os::start_thread(thread)
```cpp
//源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/os.hpp
void os::start_thread(Thread* thread) {
  // guard suspend/resume
  MutexLockerEx ml(thread->SR_lock(), Mutex::_no_safepoint_check_flag);
  OSThread* osthread = thread->osthread();
  osthread->set_state(RUNNABLE);
  pd_start_thread(thread);
}
```
* osthread->set_state(RUNNABLE)，设置线程状态 RUNNABLE
* pd_start_thread(thread)，启动线程，这个就由各个 OS 实现类，实现各自系统的启动方法了。比如，windows系统和Linux系统的代码是完全不同的。

---
##### pd_start_thread(thread)
```cpp
// 源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/os/linux/vm/os_linux.cpp
void os::pd_start_thread(Thread* thread) {
  OSThread * osthread = thread->osthread();
  assert(osthread->get_state() != INITIALIZED, "just checking");
  Monitor* sync_with_child = osthread->startThread_lock();
  MutexLockerEx ml(sync_with_child, Mutex::_no_safepoint_check_flag);
  sync_with_child->notify();
}
```
* 这部分代码 notify() 最关键，它可以唤醒线程。
* 线程唤醒后，java_start 中的 thread->run(); 就可以继续执行了。

---
#### JVM 线程回调
#####  thread->run()[JavaThread::run()]
```cpp
// 源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/thread.cpp
// The first routine called by a new Java thread
void JavaThread::run() {
  // ... 初始化线程操作
  
  thread_main_inner();
}
```
* os_linux.cpp 类中的 java_start 里的 thread->run()，最终调用的就是 thread.cpp 的 JavaThread::run() 方法。
* 这部分还需要继续往下看，thread_main_inner(); 方法。

---
##### thread_main_inner
```cpp
//源码：https://github.com/JetBrains/jdk8u_hotspot/blob/master/src/share/vm/runtime/thread.cpp
void JavaThread::thread_main_inner() {

  if (!this->has_pending_exception() &&
      !java_lang_Thread::is_stillborn(this->threadObj())) {
    {
      ResourceMark rm(this);
      this->set_native_thread_name(this->get_thread_name());
    }
    HandleMark hm(this);
    this->entry_point()(this, this);
  }

  DTRACE_THREAD_PROBE(stop, this);

  this->exit(false);
  delete this;
}
```
* 这里有你熟悉的设置的线程名称，this->set_native_thread_name(this->get_thread_name())。
* this->entry_point()，实际调用的就是 3.1 中的 thread_entry 方法。
* thread_entry，方法最终会调用到 JavaCalls::call_virtual 里的vmSymbols::run_method_name()。也就是 run() 方法，至此线程启动完成。终于串回来了！

### 总结
* 线程的启动过程涉及到了 JVM 的参与，所以如果没有认真了解过，确实很难从一个本地方法了解的如此透彻。
* 整个源码分析可以结合着代码调用UML时序图进行学习，基本核心过程包括：`Java 创建线程和启动`、`调用本地方法 start0()`、JVM 中 `JVM_StartThread 的创建和启动`、`设置线程状态等待被唤醒`、`根据不同的OS启动线程并唤醒`、`最后回调 run()` 方法启动 Java 线程。
* 有时候可能只是一步很简单的方法，也会有它的深入之处，当真的懂了以后，就不用死记硬背。


## Thread 线程，状态转换、方法使用、原理分析
### Thread 状态关系
Java 的线程状态描述在枚举类 java.lang.Thread.State 中，共包括细分如下六种状态：
```java
public enum State {
    NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED;
}
```
这五种状态描述了一个线程的生命周期，其实这种状态码的定义在我们日常的业务开发中，也经常出现。比如：一个活动的提交、审核、拒绝、修改、通过、运行、关闭等，是类似的。那么线程的状态是通过下图的方式进行流转的，如图.  
![pic](/java/thread/interview-20-1.png)
* `New`：新创建的一个线程，处于等待状态。
* `Runnable`：可运行状态，并不是已经运行，具体的线程调度各操作系统决定。**在 Runnable 中包含了 Ready、Running 两个状态**，当线程调用了 start() 方法后，线程则处于就绪 Ready 状态，等待操作系统分配 CPU 时间片，分配后则进入 Running 运行状态。此外当调用 yield() 方法后，只是谦让的允许当前线程让出CPU，**但具体让不让不一定，由操作系统决定**。如果让了，那么当前线程则会处于 Ready 状态继续竞争CPU，直至执行。
* `Timed_waiting`：指定时间内让出CPU资源，此时线程不会被执行，也不会被系统调度，直到等待时间到期后才会被执行。下列方法都可以触发：`Thread.sleep`、`Object.wait`、`Thread.join`、`LockSupport.parkNanos`、`LockSupport.parkUntil`。
* `Wating`：可被唤醒的等待状态，此时线程不会被执行也不会被系统调度。此状态可以通过 `synchronized` 获得锁，调用 wait 方法进入等待状态。最后通过 notify、notifyall 唤醒。下列方法都可以触发：`Object.wait`、`Thread.join`、`LockSupport.park`。
* `Blocked`：当发生锁竞争状态下，没有获得锁的线程会处于挂起状态。例如 synchronized 锁，先获得的先执行，没有获得的进入阻塞状态。
* `Terminated`：这个是终止状态，从 New 到 Terminated 是不可逆的。一般是程序流程正常结束或者发生了异常。
这里参考枚举`State` 类的英文注释了解了每一个状态码的含义，接下来我们去尝试操作线程方法，把这些状态体现出来。

---
### Thread 状态测试
#### NEW
```java
Thread thread = new Thread(() -> {
});
System.out.println(thread.getState());

// NEW
```
* 这个状态很简单，就是线程创建还没有启动时就是这个状态。

---
#### RUNNABLE
```java
Thread thread = new Thread(() -> {
});
// 启动
thread.start();
System.out.println(thread.getState());

// RUNNABLE

```
* 创建的线程启动后 start()，就会进入 RUNNABLE 状态。但此时并不一定在执行，而是说这个线程已经就绪，可以竞争 CPU 资源。

---
#### BLOCKED
```java
Object obj = new Object();
new Thread(() -> {
    synchronized (obj) {
        try {
            Thread.sleep(10000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}).start();

Thread thread = new Thread(() -> {
    synchronized (obj) {
        try {
            obj.wait();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
});

thread.start();
while (true) {
    Thread.sleep(1000);
    System.out.println(thread.getState());
}

// BLOCKED
// BLOCKED
// BLOCKED

```
* 这段代码稍微有点长，主要是为了让两个线程发生锁竞争。
* 第一个线程，synchronized 获取锁后休眠，不释放锁。
* 第二个线程，synchronized 获取不到锁，会被挂起。
* 那么最后的输出结果就会是，BLOCKED

---
#### WAITING
```java
Object obj = new Object();
Thread thread = new Thread(() -> {
    synchronized (obj) {
        try {
            obj.wait();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
});

thread.start();

while (true) {
    Thread.sleep(1000);
    System.out.println(thread.getState());
}

// WAITING
// WAITING
// WAITING

```
* 只要在 synchronized 代码块或者修饰的方法中，调用 wait 方法，又没有被 notify 就会进入 WAITING 状态。
* 另外 Thread.join 源码中也是调用的 wait 方法，所以也会让线程进入等待状态。

---
#### TIMED_WAITING
```java
Object obj = new Object();
Thread thread = new Thread(() -> {
    synchronized (obj) {
        try {
            Thread.sleep(100000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
});
thread.start();

while (true) {
    Thread.sleep(1000);
    System.out.println(thread.getState());
}

// TIMED_WAITING
// TIMED_WAITING
// TIMED_WAITING

```
* 有了上面状态获取的对比，这个状态的获取就没什么难度了。只要改成 Thread.sleep(100000); 就可以了。

---
#### TERMINATED
```java
Thread thread = new Thread(() -> {
});
thread.start();

System.out.println(thread.getState());
System.out.println(thread.getState());
System.out.println(thread.getState());

// RUNNABLE
// TERMINATED
// TERMINATED

```
* 这个就比较简单了，只要一个线程运行完，它的生命周期结束了，就进入了 TERMINATED 状态。

---
### Thread 方法使用
#### yield
yield 方法让出CPU，但不一定让出！这种可能会用在一些同时启动的线程中，按照优先级保证重要线程的执行，也可以是其他一些特殊的业务场景（例如这个线程内容很耗时，又不那么重要，可以放在后面）。

为了验证这个方法，我们做一个例子：启动50个线程进行，每个线程都进行1000次的加和计算。其中10个线程会执行让出CPU操作。那么，如果让出CPU那10个线程的计算加和时间都比较长，说明确实在进行让出操作。
```java
private static volatile Map<String, AtomicInteger> count = new ConcurrentHashMap<>();
static class Y implements Runnable {
    private String name;
    private boolean isYield;
    public Y(String name, boolean isYield) {
        this.name = name;
        this.isYield = isYield;
    }
    @Override
    public void run() {
        long l = System.currentTimeMillis();
        for (int i = 0; i < 1000; i++) {
            if (isYield) Thread.yield();
            AtomicInteger atomicInteger = count.get(name);
            if (null == atomicInteger) {
                count.put(name, new AtomicInteger(1));
                continue;
            }
            atomicInteger.addAndGet(1);
            count.put(name, atomicInteger);
        }
        System.out.println("线程编号：" + name + " 执行完成耗时：" + (System.currentTimeMillis() - l) + " (毫秒)" + (isYield ? "让出CPU----------------------" : "不让CPU"));
    }
}

public static void main(String[] args) {
    for (int i = 0; i < 50; i++) {
        if (i < 10) {
            new Thread(new Y(String.valueOf(i), true)).start();
            continue;
        }
        new Thread(new Y(String.valueOf(i), false)).start();
    }
}
```
**测试结果**
```java
线程编号：10 执行完成耗时：2 (毫秒)不让CPU
线程编号：11 执行完成耗时：2 (毫秒)不让CPU
线程编号：15 执行完成耗时：1 (毫秒)不让CPU
线程编号：14 执行完成耗时：1 (毫秒)不让CPU
线程编号：19 执行完成耗时：1 (毫秒)不让CPU
线程编号：18 执行完成耗时：1 (毫秒)不让CPU
线程编号：22 执行完成耗时：0 (毫秒)不让CPU
线程编号：26 执行完成耗时：0 (毫秒)不让CPU
线程编号：27 执行完成耗时：1 (毫秒)不让CPU
线程编号：30 执行完成耗时：0 (毫秒)不让CPU
线程编号：31 执行完成耗时：0 (毫秒)不让CPU
线程编号：34 执行完成耗时：1 (毫秒)不让CPU
线程编号：12 执行完成耗时：1 (毫秒)不让CPU
线程编号：16 执行完成耗时：1 (毫秒)不让CPU
线程编号：13 执行完成耗时：1 (毫秒)不让CPU
线程编号：17 执行完成耗时：1 (毫秒)不让CPU
线程编号：20 执行完成耗时：0 (毫秒)不让CPU
线程编号：23 执行完成耗时：0 (毫秒)不让CPU
线程编号：21 执行完成耗时：0 (毫秒)不让CPU
线程编号：25 执行完成耗时：1 (毫秒)不让CPU
线程编号：24 执行完成耗时：1 (毫秒)不让CPU
线程编号：28 执行完成耗时：0 (毫秒)不让CPU
线程编号：38 执行完成耗时：0 (毫秒)不让CPU
线程编号：39 执行完成耗时：0 (毫秒)不让CPU
线程编号：37 执行完成耗时：1 (毫秒)不让CPU
线程编号：40 执行完成耗时：0 (毫秒)不让CPU
线程编号：44 执行完成耗时：0 (毫秒)不让CPU
线程编号：36 执行完成耗时：1 (毫秒)不让CPU
线程编号：42 执行完成耗时：1 (毫秒)不让CPU
线程编号：45 执行完成耗时：1 (毫秒)不让CPU
线程编号：43 执行完成耗时：1 (毫秒)不让CPU
线程编号：46 执行完成耗时：0 (毫秒)不让CPU
线程编号：47 执行完成耗时：0 (毫秒)不让CPU
线程编号：35 执行完成耗时：0 (毫秒)不让CPU
线程编号：33 执行完成耗时：0 (毫秒)不让CPU
线程编号：32 执行完成耗时：0 (毫秒)不让CPU
线程编号：41 执行完成耗时：0 (毫秒)不让CPU
线程编号：48 执行完成耗时：1 (毫秒)不让CPU
线程编号：6 执行完成耗时：15 (毫秒)让出CPU----------------------
线程编号：7 执行完成耗时：15 (毫秒)让出CPU----------------------
线程编号：49 执行完成耗时：2 (毫秒)不让CPU
线程编号：29 执行完成耗时：1 (毫秒)不让CPU
线程编号：2 执行完成耗时：17 (毫秒)让出CPU----------------------
线程编号：1 执行完成耗时：11 (毫秒)让出CPU----------------------
线程编号：4 执行完成耗时：15 (毫秒)让出CPU----------------------
线程编号：8 执行完成耗时：12 (毫秒)让出CPU----------------------
线程编号：5 执行完成耗时：12 (毫秒)让出CPU----------------------
线程编号：9 执行完成耗时：12 (毫秒)让出CPU----------------------
线程编号：0 执行完成耗时：21 (毫秒)让出CPU----------------------
线程编号：3 执行完成耗时：21 (毫秒)让出CPU----------------------
```
* 从测试结果可以看到，那些让出 CPU 的，执行完计算已经在10毫秒以上，说明我们的测试是效果的。

---
#### wait & notify
wait 和 notify/nofityall，是一对方法，有一个等待，就会有一个叫醒，否则程序就夯在那不动了。关于这部分会使用到的 [synchronized](/java/synchronized#对象结构介绍) 在之前有深入的源码分析，讲到它是怎么加锁在对象头的，如果你忘记了可以翻翻看

接下来我们模拟鹿鼎记·丽春院，清倌喝茶吟诗聊风月日常。当有达官贵人来时，需要分配清倌给大老爷。中间会有一些等待、叫醒操作。只为让你更好的记住这样的案例，不要想歪喽。清倌人即是只卖艺欢场人，喊麦的。
```java
public class 丽春院 {

    public static void main(String[] args) {
        老鸨 鸨子 = new 老鸨();

        清倌 miss = new 清倌(鸨子);
        客官 guest = new 客官(鸨子);

        Thread t_miss = new Thread(miss);
        Thread t_guest = new Thread(guest);

        t_miss.start();
        t_guest.start();
    }

}

class 清倌 implements Runnable {

    老鸨 鸨子;

    public 清倌(老鸨 鸨子) {
        this.鸨子 = 鸨子;
    }

    @Override
    public void run() {
        int i = 1;
        while (true) {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e1) {
                e1.printStackTrace();
            }
            if (i == 1) {
                try {
                    鸨子.在岗清倌("苍田野子", "500 日元");
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            } else {
                try {
                    鸨子.在岗清倌("花田岗子", "800 日元");
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
            i = (i + 1) % 2;
        }
    }

}

class 客官 implements Runnable {

    老鸨 鸨子;

    public 客官(老鸨 鸨子) {
        this.鸨子 = 鸨子;
    }

    @Override
    public void run() {
        while (true) {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e1) {
                e1.printStackTrace();
            }
            try {
                鸨子.喝茶吟诗聊风月();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

}

class 老鸨 {

    private String 清倌 = null;
    private String price = null;
    private boolean 工作状态 = true;

    public synchronized void 在岗清倌(String 清倌, String price) throws InterruptedException {
        if (!工作状态)
            wait();//等待
        this.清倌 = 清倌;
        this.price = price;
        工作状态 = false;
        notify();//叫醒
    }

    public synchronized void 喝茶吟诗聊风月() throws InterruptedException {
        if (工作状态)
            wait();//等待
        System.out.println("聊风月：" + 清倌);
        System.out.println("茶水费：" + price);
        System.out.println("  " + "  " + "  " + "  " + "  " + "  " + "  " + "  " + "  " + "  " + 清倌 + "完事" + "准备 ... ...");
        System.out.println("****************************************");
        工作状态 = true;
        notify();//叫醒
    }

}
```
**测试结果**
```java
聊风月：苍田野子
茶水费：500 日元
                    苍田野子完事准备 ... ...
****************************************
聊风月：花田岗子
茶水费：800 日元
                    花田岗子完事准备 ... ...
****************************************
聊风月：苍田野子
茶水费：500 日元
                    苍田野子完事准备 ... ...
****************************************

...
```
* 效果效果主要体现 wait、notify，这两个方法的使用。我相信你一定能记住这个例子！

---
#### join
join 是两个线程的合并吗？不是的！

join 是让线程进入 `wait` ，当线程执行完毕后，会在JVM源码中找到，它执行完毕后，其实执行`notify`，也就是 `等待` 和 `叫醒` 操作。
```cpp
//源码：jdk8u_hotspot/blob/master/src/share/vm/runtime/thread.cpp
void JavaThread::exit(bool destroy_vm, ExitType exit_type) {
	// Notify waiters on thread object. This has to be done after exit() is called
	// on the thread (if the thread is the last thread in a daemon ThreadGroup the
	// group should have the destroyed bit set before waiters are notified).
	ensure_join(this);
}
```
```cpp
static void ensure_join(JavaThread* thread) {
  // 叫醒
  java_lang_Thread::set_thread(threadObj(), NULL);
  lock.notify_all(thread);
}
```
好的，就是这里！`lock.notify_all(thread)`，执行到这，就对上了。

* 案例：
```java
Thread thread = new Thread(() -> {
    System.out.println("thread before");
    try {
        Thread.sleep(3000);
    } catch (Exception e) {
        e.printStackTrace();
    }
    System.out.println("thread after");
});
thread.start();
System.out.println("main begin！");
thread.join();
System.out.println("main end！");
```
* 结果：
```java
main begin！
thread before
thread after
main end！

Process finished with exit code 0
```
首先join() 是一个synchronized方法， 里面调用了wait()，这个过程的目的是让持有这个同步锁的线程进入等待，那么谁持有了这个同步锁呢？答案是主线程，因为主线程调用了thread.join()方法，相当于在thread.join()代码这块写了一个同步代码块，谁去执行了这段代码呢，是主线程，所以主线程被wait()了。然后在子线程thread执行完毕之后，JVM会调用lock.notify_all(thread);唤醒持有thread这个对象锁的线程，也就是主线程，会继续执行。
* 这部分验证的主要体现就是加了 `thread.join()` 后，会影响到输出结果。如果不加，main end！ 会优先 thread after 提前打印出来
* join() 是一个 `synchronized` 方法，里面调用了` wait()` 方法，让持有当前同步锁的线程进入等待状态，也就是主线程。当子线程执行完毕后，我们从源码中可以看到 JVM 调用了 `lock.notify_all(thread) `所以唤醒了主线程继续执行。
* thread.join()方法会让调用它的线程（在这个例子中是主线程）阻塞，直到被调用的线程（在这个例子中是thread）执行完成或者超时。在这段代码中，主线程调用了thread.join()，因此主线程会被阻塞，直到thread线程执行完成才会继续执行后续代码。

---
### 总结
* 线程状态和状态的转换也是面试中必问的问题，但除了面试是我们自己在开发中，如果真的使用线程，是非常有必要了解线程状态是如何转换的。模模糊糊的使用，总会觉得担心，那么你是个好程序员！
* 线程的一些深入学习都是在调用本地方法，也就是需要了解到JVM层面，才能更加深刻的见到c++代码是如何实现这部分逻辑的。
* 在使用线程的时候一定要让自己有一个类似多核的脑子：线程一起、生死由你！ 
* 本章节就扯到这了，很多的知识都是为了整套内容体系的全面，为后续介绍其他知识打下根基。感谢！