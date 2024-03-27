# volatile
volatile 是一种关键字，用于保证多线程情况下共享变量的可见性。当一个变量被声明为 volatile 时，每个线程在访问该变量时都会立即刷新其本地内存（工作内存）中该变量的值，确保所有线程都能读到最新的值。并且使用 volatile 可以禁止指令重排序，这样就能有效的预防，因为指令优化（重排序）而导致的线程安全问题。也就是说 volatile 有两个主要功能：**保证内存可见性**和**禁止指令重排序**。
## 内存可见性
### 案例
```java
public class ApiTest {

    public static void main(String[] args) {
        final VT vt = new VT();

        Thread Thread01 = new Thread(vt);
        Thread Thread02 = new Thread(new Runnable() {
            public void run() {
                try {
                    Thread.sleep(3000);
                } catch (InterruptedException ignore) {
                }
                vt.sign = true;
                System.out.println("vt.sign = true 通知 while (!sign) 结束！");
            }
        });

        Thread01.start();
        Thread02.start();
    }

}

class VT implements Runnable {

    public boolean sign = false;

    public void run() {
        while (!sign) {
        }
        System.out.println("你坏");
    }
}
```
这段代码，是两个线程操作一个变量，程序期望当 sign 在线程 Thread01 被操作 vt.sign = true 时，Thread02 输出 "你坏"。但实际上这段代码永远不会输出 你坏，而是一直处于死循环。这是为什么呢？接下来我们就一步步讲解和验证。

**加上volatile关键字**
我们把 sign 关键字加上 volatitle 描述，如下：
```java
class VT implements Runnable {

    public volatile boolean sign = false;

    public void run() {
        while (!sign) {
        }
        System.out.println("你坏");
    }
}
```
测试结果
```java
vt.sign = true 通知 while (!sign) 结束！
你坏

Process finished with exit code 0
```
volatile关键字是Java虚拟机提供的的最轻量级的同步机制，它作为一个修饰符出现，用来修饰变量，但是这里不包括局部变量哦

在添加 volatile 关键字后，程序就符合预期的输出了 你坏。从我们对 volatile 的学习认知可以知道。volatile关键字是 JVM 提供的最轻量级的同步机制，用来修饰变量，用来保证变量对所有线程可见性。

正在修饰后可以让字段在线程间可见，那么这个属性被修改值后，可以及时的在另外的线程中做出相应的反应。

---
### volatile怎么保证内存可见性
#### 1. 无volatile时，内存变化
![pic](/java/volatile/interview-14-03.png)
首先是当 sign 没有 volatile 修饰时 public boolean sign = false;，线程01对变量进行操作，线程02并不会拿到变化的值。所以程序也就不会输出结果 “你坏”
#### 2. 有volatile时，内存变化
![pic](/java/volatile/interview-14-04.png)
当我们把变量使用 volatile 修饰时 public volatile boolean sign = false;，线程01对变量进行操作时，会把变量变化的值强制刷新的到主内存。当线程02获取值时，会把自己的内存里的 sign 值过期掉，之后从主内存中读取。所以添加关键字后程序如预期输出结果。
#### 3. 特殊情况
 > 在Java中，当多个线程同时访问共享变量时，由于线程的本地缓存（工作内存）和主内存之间的不一致性，可能导致一个线程在读取共享变量时看到的是过期的值。这是因为在多线程环境下，为了提高执行效率，JVM和处理器会对指令进行重排序和优化，并且线程之间的操作可能以不同的顺序执行。这种重排序和优化的行为可能导致线程在访问共享变量时看到的值不一致。而调用System.out.println方法时，它涉及到对输出流的操作，而输出流通常涉及底层的I/O操作，并且在输出流的操作过程中会有一定的同步机制。这些同步机制（如加锁、数据的刷新等）可以强制将线程的本地缓存中的数据刷新回主内存，从而保证了最新的变量值被输出。因此，在使用System.out.println方法时，由于输出流的同步机制，它会强制将线程的本地缓存中的数据刷新回主内存，从而可以确保读取到最新的变量值。但需要注意的是，虽然在使用System.out.println时可以看到最新的变量值，但这并不意味着它是一种可靠的线程间通信机制。要实现线程间的可靠通信，需要使用专门的同步机制（如synchronized、volatile、Lock等）来保证数据的可见性和一致性。

---
### 反编译解读可见性
类似这样有深度的技术知识，最佳的方式就是深入理解原理，看看它到底做了什么才保证的内存可见性操作。
#### 1. 查看JVM指令
指令：```javap -v -p VT```
```java
 public volatile boolean sign;
    descriptor: Z
    flags: ACC_PUBLIC, ACC_VOLATILE

  org.itstack.interview.test.VT();
    descriptor: ()V
    flags:
    Code:
      stack=2, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: aload_0
         5: iconst_0
         6: putfield      #2                  // Field sign:Z
         9: return
      LineNumberTable:
        line 35: 0
        line 37: 4
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0      10     0  this   Lorg/itstack/interview/test/VT;

  public void run();
    descriptor: ()V
    flags: ACC_PUBLIC
    Code:
      stack=2, locals=1, args_size=1
         0: aload_0
         1: getfield      #2                  // Field sign:Z
         4: ifne          10
         7: goto          0
        10: getstatic     #3                  // Field java/lang/System.out:Ljava/io/PrintStream;
        13: ldc           #4                  // String 你坏
        15: invokevirtual #5                  // Method java/io/PrintStream.println:(Ljava/lang/String;)V
        18: return
      LineNumberTable:
        line 40: 0
        line 42: 10
        line 43: 18
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0      19     0  this   Lorg/itstack/interview/test/VT;
      StackMapTable: number_of_entries = 2
        frame_type = 0 /* same */
        frame_type = 9 /* same */
}
```
从JVM指令码中只会发现多了，```ACC_VOLATILE```，并没有什么其他的点。所以，也不能看出是怎么实现的可见性。
#### 2. 查看汇编指令
通过Class文件查看汇编，需要下载 ```hsdis-amd64.dll``` 文件，复制到 ```JAVA_HOME\jre\bin\server```目录下。下载资源如下：
* http://vorboss.dl.sourceforge.net/project/fcml/fcml-1.1.1/hsdis-1.1.1-win32-amd64.zip(opens new window)
* http://vorboss.dl.sourceforge.net/project/fcml/fcml-1.1.1/hsdis-1.1.1-win32-i386.zip
另外是执行命令，包括：

1. 基础指令：```java -Xcomp -XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly```
2. 指定打印：```-XX:CompileCommand=dontinline,类名.方法名```
3. 指定打印：```-XX:CompileCommand=compileonly,类名.方法名```
4. 输出位置：```> xxx```
5. 最终使用：```java -Xcomp -XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly -XX:CompileCommand=dontinline,ApiTest.main -XX:CompileCommand=compileonly,ApiTest.mian```

指令可以在IDEA中的 Terminal 里使用，也可以到 DOS黑窗口中使用
另外，为了更简单的使用，我们把指令可以配置到idea的``` VM options``` 里，如下图：
![pic](/java/volatile/interview-14-05.png)
配置完成后，不出意外的运行结果如下：
```java
Loaded disassembler from C:\Program Files\Java\jdk1.8.0_161\jre\bin\server\hsdis-amd64.dll
Decoding compiled method 0x0000000003744990:
Code:
Argument 0 is unknown.RIP: 0x3744ae0 Code size: 0x00000110
[Disassembling for mach='amd64']
[Entry Point]
[Constants]
  # {method} {0x000000001c853d18} 'getSnapshotTransformerList' '()[Lsun/instrument/TransformerManager$TransformerInfo;' in 'sun/instrument/TransformerManager'
  #           [sp+0x40]  (sp of caller)
  0x0000000003744ae0: mov     r10d,dword ptr [rdx+8h]
  0x0000000003744ae4: shl     r10,3h
  0x0000000003744ae8: cmp     r10,rax
  0x0000000003744aeb: jne     3685f60h          ;   {runtime_call}
  0x0000000003744af1: nop     word ptr [rax+rax+0h]
  0x0000000003744afc: nop
[Verified Entry Point]
  0x0000000003744b00: mov     dword ptr [rsp+0ffffffffffffa000h],eax
  0x0000000003744b07: push    rbp
  0x0000000003744b08: sub     rsp,30h           ;*aload_0
                                                ; - sun.instrument.TransformerManager::getSnapshotTransformerList@0 (line 166)

  0x0000000003744b0c: mov     eax,dword ptr [rdx+10h]
  0x0000000003744b0f: shl     rax,3h            ;*getfield mTransformerList
                                                ; - sun.instrument.TransformerManager::getSnapshotTransformerList@1 (line 166)

  0x0000000003744b13: add     rsp,30h
...
```
运行结果就是汇编指令，比较多这里就不都放了。我们只观察🕵重点部分：
```java
   0x0000000003324cda: mov    0x74(%r8),%edx     ;*getstatic state
                                                 ; - VT::run@28 (line 27)
 
   0x0000000003324cde: inc    %edx
   0x0000000003324ce0: mov    %edx,0x74(%r8)
   0x0000000003324ce4: lock addl $0x0,(%rsp)     ;*putstatic state
                                                 ; - VT::run@33 (line 27)
```
编译后的汇编指令中，有volatile关键字和没有volatile关键字，主要差别在于多了一个 ```lock addl $0x0,(%rsp)```，也就是lock的前缀指令。

**lock**指令相当于一个内存屏障，它保证如下三点：
1. 将本处理器的缓存写入内存。
2. 重排序时不能把后面的指令重排序到内存屏障之前的位置。
3. 如果是写入动作会导致其他处理器中对应的内存无效。
那么，这里的1、3就是用来保证被修饰的变量，保证内存可见性。

---
### 不加volatile也可见吗
**[看上方的特殊情况](#volatile怎么保证的可见性)**
### 总结
* 最后我们再总结下 volatile，它呢，会控制被修饰的变量在内存操作上主动把值刷新到主内存，JVM 会把该线程对应的CPU内存设置过期，从主内存中读取最新值。
* 那么，volatile 如何防止指令重排也是内存屏障，volatile 的内存屏故障是在读写操作的前后各添加一个 StoreStore屏障，也就是四个位置，来保证重排序时不能把内存屏障后面的指令重排序到内存屏障之前的位置。
* 另外 volatile 并不能解决原子性，如果需要解决原子性问题，需要使用 synchronzied 或者 lock，这部分内容在我们后续章节中介绍。

## 禁止指令重排序
### 案例
指令重排序是指编译器或 CPU 为了优化程序的执行性能，而对指令进行重新排序的一种手段。指令重排序的实现初衷是好的，但是在多线程执行中，如果执行了指令重排序可能会导致程序执行出错。指令重排序最典型的一个问题就发生在单例模式中，比如以下问题代码：
```java
public class Singleton {
    private Singleton() {}
    private static Singleton instance = null;
    public static Singleton getInstance() {
        if (instance == null) { // ①
            synchronized (Singleton.class) {
            	if (instance == null) {
                	instance = new Singleton(); // ②
                }
            }
        }
        return instance;
    }
}
```
以上问题发生在代码 ② 这一行```instance = new Singleton();```，这行代码看似只是一个创建对象的过程，**然而它的实际执行却分为以下 3 步**：
1. **创建内存空间。**
2. **在内存空间中初始化对象 Singleton。**
3. **将内存地址赋值给 instance 对象（执行了此步骤，instance 就不等于 null 了）。**

**如果此变量不加 volatile，那么线程 1 在执行到上述代码的第 ② 处时就可能会执行指令重排序，将原本是 1、2、3 的执行顺序，重排为 1、3、2。但是特殊情况下，线程 1 在执行完第 3 步之后，如果来了线程 2 执行到上述代码的第 ① 处，判断 instance 对象已经不为 null，但此时线程 1 还未将对象实例化完，那么线程 2 将会得到一个被实例化“一半”的对象，从而导致程序执行出错，这就是为什么要给私有变量添加 volatile 的原因了。 要使以上单例模式变为线程安全的程序，需要给 instance 变量添加 volatile 修饰**，它的最终实现代码如下：
```java
public class Singleton {
    private Singleton() {}
    // 使用 volatile 禁止指令重排序
    private static volatile Singleton instance = null; // 【主要是此行代码发生了变化】
    public static Singleton getInstance() {
        if (instance == null) { // ①
            synchronized (Singleton.class) {
            	if (instance == null) {
                	instance = new Singleton(); // ②
                }
            }
        }
        return instance;
    }
}
```
### 总结
volatile 是 Java 并发编程的重要组成部分，它的主要作用有两个：保证内存的可见性和禁止指令重排序。volatile 常使用在一写多读的场景中，比如 CopyOnWriteArrayList 集合，它在操作的时候会把全部数据复制出来对写操作加锁，修改完之后再使用 setArray 方法把此数组赋值为更新后的值，使用 volatile 可以使读线程很快的告知到数组被修改，不会进行指令重排，操作完成后就可以对其他线程可见了。