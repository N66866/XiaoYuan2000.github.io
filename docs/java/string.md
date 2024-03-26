# String、StringBuilder、StringBuffer(基于jdk8)
## StringBuilder 比 String 快？
### 证据
* 分别使用了 String、StringBuilder、StringBuffer，做字符串链接操作(100个、1000个、1万个、10万个、100万个)，记录每种方式的耗时  
![pic](/java/string/interview-12-01.png)
从上图可以得出以下结论；
1. String 字符串链接是耗时的，尤其数据量大的时候，简直没法使用了。这是做实验，基本也不会有人这么干！
2. StringBuilder、StringBuffer，因为没有发生多线程竞争也就没有🔒锁升级，所以两个类耗时几乎相同，当然在单线程下更推荐使用 StringBuilder 。
### 原因
```java
String str = "";
for (int i = 0; i < 10000; i++) {
    str += i;
}
```
这段代码就是三种字符串拼接方式，最慢的一种。不是说这种+加的符号，会被优化成 StringBuilder 吗，那怎么还慢？
* 确实JVM编译时会将 ‘+’连接的字符串优化，但是会优化成以下样子。会在循环中new 一个StringBuilder，非常耗时，所以还是得自己把StringBUilder提到循环外。
```java
String str = "";
for (int i = 0; i < 10000; i++) {
    str = new StringBuilder().append(str).append(i).toString();
}
```

## String源码分析
```java
public final class String
    implements java.io.Serializable, Comparable<String>, CharSequence {
    /** The value is used for character storage. */
    private final char value[];

    /** Cache the hash code for the string */
    private int hash; // Default to 0

    /** use serialVersionUID from JDK 1.0.2 for interoperability */
    private static final long serialVersionUID = -6849794470754667710L;
 	
    ...
}
```
### 1. 初始化
一般情况下，使用String一般只能使用 ```String str = "aaa";```,但因为 String 的底层数据结构是数组char value[]，所以它的初始化方式也会有很多跟数组相关的，如下:
```java
String str_01 = "abc";
System.out.println("默认方式：" + str_01);

String str_02 = new String(new char[]{'a', 'b', 'c'});
System.out.println("char方式：" + str_02);

String str_03 = new String(new int[]{0x61, 0x62, 0x63}, 0, 3);
System.out.println("int方式：" + str_03);

String str_04 = new String(new byte[]{0x61, 0x62, 0x63});
System.out.println("byte方式：" + str_04);
```
**以上这些方式都可以初始化，并且最终的结果是一致的: abc**
所以```str.charAt(0);```的效率是非常高的，源码如下：
```java
public char charAt(int index) {
    if ((index < 0) || (index >= value.length)) {
        throw new StringIndexOutOfBoundsException(index);
    }
    return value[index];
}
```
### 2.不可变
字符串创建后是不可变的，你看到的+加号连接操作，都是创建了新的对象把数据存放过去，通过源码就可以看到：  
![pic](/java/string/interview-12-03.png)
从源码中可以看到，String 的类和用于存放字符串的方法都用了 final 修饰，也就是创建了以后，这些都是不可变的。
例如：
```java
String str_01 = "abc";
String str_02 = "abc" + "def";
String str_03 = str_01 + "def";
```
这段代码会初始化3个对象，把代码反编译看：
```java
  public void test_00();
    Code:
       0: ldc           #2                  // String abc
       2: astore_1
       3: ldc           #3                  // String abcdef
       5: astore_2
       6: new           #4                  // class java/lang/StringBuilder
       9: dup
      10: invokespecial #5                  // Method java/lang/StringBuilder."<init>":()V
      13: aload_1
      14: invokevirtual #6                  // Method java/lang/StringBuilder.append:(Ljava/lang/String;)Ljava/lang/StringBuilder;
      17: ldc           #7                  // String def
      19: invokevirtual #6                  // Method java/lang/StringBuilder.append:(Ljava/lang/String;)Ljava/lang/StringBuilder;
      22: invokevirtual #8                  // Method java/lang/StringBuilder.toString:()Ljava/lang/String;
      25: astore_3
      26: return
```
* str_01 = "abc"，指令码：0: ldc，创建了一个对象。
* str_02 = "abc" + "def"，指令码：3: ldc // String abcdef，得益于JVM编译期的优化，两个字符串会进行相连，创建一个对象存储。
* str_03 = str_01 + "def"，指令码：invokevirtual，这个就不一样了，它需要把两个字符串相连，会创建StringBuilder对象，直至最后toString:()操作，共创建了三个对象。  
* **所以，我们看到，字符串的创建是不能被修改的，相连操作会创建出新对象。**
## 面试经典问题String 之 intern
### 小试牛刀
来试试写出以下代码的输出结果
```java
String str_1 = new String("ab");
String str_2 = new String("ab");
String str_3 = "ab";

System.out.println(str_1 == str_2);
System.out.println(str_1 == str_2.intern());
System.out.println(str_1.intern() == str_2.intern());
System.out.println(str_1 == str_3);
System.out.println(str_1.intern() == str_3);
```
揭晓答案
```java
false
false
true
false
true
```
问题解析：String.intern() 方法是 Java 中的一个方法，它用于将字符串对象添加到字符串常量池中，**并返回字符串常量池中的引用**。
### 源码分析
先看下它的源码:
```java
/**
 * Returns a canonical representation for the string object.
 * <p>
 * A pool of strings, initially empty, is maintained privately by the
 * class {@code String}.
 * <p>
 * When the intern method is invoked, if the pool already contains a
 * string equal to this {@code String} object as determined by
 * the {@link #equals(Object)} method, then the string from the pool is
 * returned. Otherwise, this {@code String} object is added to the
 * pool and a reference to this {@code String} object is returned.
 * <p>
 * It follows that for any two strings {@code s} and {@code t},
 * {@code s.intern() == t.intern()} is {@code true}
 * if and only if {@code s.equals(t)} is {@code true}.
 * <p>
 * All literal strings and string-valued constant expressions are
 * interned. String literals are defined in section 3.10.5 of the
 * <cite>The Java&trade; Language Specification</cite>.
 *
 * @return  a string that has the same contents as this string, but is
 *          guaranteed to be from a pool of unique strings.
 */
public native String intern();
```
这段代码和注释什么意思呢？
native，说明 intern() 是一个本地方法，底层通过JNI调用C++语言编写的功能.
> 后续可能会扩展JNI的知识

```\openjdk8\jdk\src\share\native\java\lang\String.c```
```cpp
Java_java_lang_String_intern(JNIEnv *env, jobject this)  
{  
    return JVM_InternString(env, this);  
}  

oop result = StringTable::intern(string, CHECK_NULL);

oop StringTable::intern(Handle string_or_null, jchar* name,  
                        int len, TRAPS) {  
  unsigned int hashValue = java_lang_String::hash_string(name, len);  
  int index = the_table()->hash_to_index(hashValue);  
  oop string = the_table()->lookup(index, name, len, hashValue);  
  if (string != NULL) return string;   
  return the_table()->basic_add(index, string_or_null, name, len,  
                                hashValue, CHECK_NULL);  
}
```
StringTable 是一个固定长度的数组 1009 个大小，jdk1.6不可调、jdk1.7可以设置-XX:StringTableSize，按需调整。
### 图解
![pic](/java/string/interview-12-04.png)
看图说话，如下；

1. 先说 ==，基础类型比对的是值，引用类型比对的是地址。另外，equal 比对的是哈希值。
2. 两个new出来的对象，地址肯定不同，所以是false。
3. intern()，直接把值推进了常量池，所以两个对象都做了 intern() 操作后，比对是常量池里的值。
4. str_3 = "ab"，赋值，JVM编译器做了优化，不会重新创建对象，直接引用常量池里的值。所以str_1.intern() == str_3，比对结果是true。
* 理解了这个结构，根本不需要死记硬背应对面试，让懂了就是真的懂，大脑也会跟着愉悦。

## StringBuilder 源码分析
### 初始化
```java
new StringBuilder();
new StringBuilder(16);
new StringBuilder("abc");
```
这几种方式都可以初始化，你可以传一个初始化容量，也可以初始化一个默认的字符串。它的源码如下:
```java
public StringBuilder() {
    super(16);
}

AbstractStringBuilder(int capacity) {
    value = new char[capacity];
}
```
定睛一看，这就是在初始化数组呀！那是不操作起来跟使用 ArrayList 似的呀！
### 添加元素
```java
stringBuilder.append("a");
stringBuilder.append("b");
stringBuilder.append("c");
```
#### 入口方法
```java
// StringBuilder父类，共用这个append
public AbstractStringBuilder append(String str) { 
    if (str == null)
        return appendNull();
    int len = str.length();
    ensureCapacityInternal(count + len);
    str.getChars(0, len, value, count);
    count += len;
    return this;
}
```
* 这里包括了容量检测、元素拷贝、记录 count 数量。
#### 扩容操作
```ensureCapacityInternal(count + len);```
```java
/**
 * This method has the same contract as ensureCapacity, but is
 * never synchronized.
 */
private void ensureCapacityInternal(int minimumCapacity) {
    // overflow-conscious code
    if (minimumCapacity - value.length > 0)
        expandCapacity(minimumCapacity);
}

/**
 * This implements the expansion semantics of ensureCapacity with no
 * size check or synchronization.
 */
void expandCapacity(int minimumCapacity) {
    int newCapacity = value.length * 2 + 2; //jdk17中使用 << 1 位移方法
    if (newCapacity - minimumCapacity < 0)
        newCapacity = minimumCapacity;
    if (newCapacity < 0) {
        if (minimumCapacity < 0) // overflow
            throw new OutOfMemoryError();
        newCapacity = Integer.MAX_VALUE;
    }
    value = Arrays.copyOf(value, newCapacity);
}
```
如上，StringBuilder，就跟操作数组的原理一样，都需要检测容量大小，按需扩容。扩容的容量是 n * 2 + 2，另外把原有元素拷贝到新数组中。
#### 填充元素
```str.getChars(0, len, value, count);```
```java
public void getChars(int srcBegin, int srcEnd, char dst[], int dstBegin) {
    // ...
    System.arraycopy(value, srcBegin, dst, dstBegin, srcEnd - srcBegin);
}
```
添加元素的方式是基于 System.arraycopy 拷贝操作进行的，这是一个本地方法(native)。
#### toString()
既然 stringBuilder 是数组，那么它是怎么转换成字符串的呢？
> stringBuilder.toString();
```java
// 其实需要用到它是 String 字符串的时候，就是使用 String 的构造函数传递数组进行转换的，这个方法在我们上面讲解 String 的时候已经介绍过。
@Override
public String toString() {
    // Create a copy, don't share the array
    return new String(value, 0, count);
}
```
## StringBuffer 源码分析
StringBuffer 与 StringBuilder，API的使用和底层实现上基本一致，维度不同的是 StringBuffer 加了 synchronized 🔒锁，所以它是线程安全的。源码如下:
```java
@Override
public synchronized StringBuffer append(String str) {
    toStringCache = null;
    super.append(str);
    return this;
}
```
那么，```synchronized``` 不是重量级锁吗，JVM对它有什么优化呢?后面会详细讲述这块知识。
其实为了减少获得锁与释放锁带来的性能损耗，从而引入了偏向锁、轻量级锁、重量级锁来进行优化，它的进行一个锁升级，如下图(此图引自互联网用户：韭韭韭韭菜，画的非常优秀):
![pic](/java/string/interview-12-05.png)
1. 从无锁状态开始，当线程进入 ```synchronized``` 同步代码块，会检查对象头和栈帧内是否有当前线下ID编号，无则使用 CAS 替换。
2. 解锁时，会使用 CAS 将 Displaced Mark Word 替换回到对象头，如果成功，则表示竞争没有发生，反之则表示当前锁存在竞争锁就会升级成重量级锁。
3. 另外，大多数情况下锁🔒是不发生竞争的，基本由一个线程持有。所以，为了避免获得锁与释放锁带来的性能损耗，所以引入锁升级，升级后不能降级。