# queue
## Stack
我们说Stack栈，这个实现类已经不推荐使用了，需要从它的源码上看。
```java
/**
 *
 * <p>A more complete and consistent set of LIFO stack operations is
 * provided by the {@link Deque} interface and its implementations, which
 * should be used in preference to this class.  For example:
 * <pre>   {@code
 *   Deque<Integer> stack = new ArrayDeque<Integer>();}</pre>
 *   
 * @author  Jonathan Payne
 * @since   JDK1.0
 */
public class Stack<E> extends Vector<E> 

public synchronized void addElement(E obj) {
    modCount++;
    ensureCapacityHelper(elementCount + 1);
    elementData[elementCount++] = obj;
}
```
1. Stack 栈是在JDK1.0时代时，基于继承Vector，实现的。本身Vector就是一个不推荐使用的类，主要在于它的一些操作方法锁🔒(synchronized)的力度太粗，都是放到方法上。
2. Stack 栈底层是使用Vector数组实现，在学习ArrayList时候我们知道，数组结构在元素添加和擅长需要通过System.arraycopy，进行扩容操作。而本身栈的特点是首尾元素的操作，也不需要遍历，使用数组结构其实并不太理想。
3. 同时在这个方法的注释上也明确标出来，推荐使用
```java
Deque<Integer> stack = new ArrayDeque<Integer>();
```
虽然这也是数组结构，但是它没有粗粒度的锁，同时可以申请指定空间并且在扩容时操作时也要优于Stack 。并且它还是一个双端队列，使用起来更灵活。

## 双端队列ArrayDeque
### 功能使用
ArrayDeque 是基于数组实现的可动态扩容的双端队列，也就是说你可以在队列的头和尾同时插入和弹出元素。当元素数量超过数组初始化长度时，则需要扩容和迁移数据。
![pic](/java/arraydueue/interview-10-04.png)
* 双端队列是基于数组实现，所以扩容迁移数据操作。
* push、offerFirst、addFirst，头插方法，效果一致、offerLast、addLast，尾插方法，这样两端都满足后进先出。
* 整体来看，双端队列，就是一个环形。所以扩容后继续插入元素也满足后进先出。
```java
@Test
public void test_ArrayDeque() {
    Deque<String> deque = new ArrayDeque<String>(1);
    
    deque.push("a");
    deque.push("b");
    deque.push("c");
    deque.push("d");
    
    deque.offerLast("e");
    deque.offerLast("f");
    deque.offerLast("g");
    deque.offerLast("h");  // 这时候扩容了
    
    deque.push("i");
    deque.offerLast("j");
    
    System.out.println("数据出栈：");
    while (!deque.isEmpty()) {
        System.out.print(deque.pop() + " ");
    }
}

数据出栈：
i d c b a e f g h j 
Process finished with exit code 0
```
*i d c b a e f g h j，正好满足了我们的说的数据出栈顺序。可以参考上图再进行理解 

### 源码分析
ArrayDeque 这种双端队列是基于数组实现的，所以源码上从初始化到数据入栈扩容，都会有数组操作的痕迹。接下来我们就依次分析下。
#### 初始化
```java
new ArrayDeque<String>(1);，//其实它的构造函数初始化默认也提供了几个方法，比如你可以指定大小以及提供默认元素。

private static int calculateSize(int numElements) {
    int initialCapacity = MIN_INITIAL_CAPACITY;
    // Find the best power of two to hold elements.
    // Tests "<=" because arrays aren't kept full.
    if (numElements >= initialCapacity) {
        initialCapacity = numElements;
        initialCapacity |= (initialCapacity >>>  1);
        initialCapacity |= (initialCapacity >>>  2);
        initialCapacity |= (initialCapacity >>>  4);
        initialCapacity |= (initialCapacity >>>  8);
        initialCapacity |= (initialCapacity >>> 16);
        initialCapacity++;
        if (initialCapacity < 0)   // Too many elements, must back off
            initialCapacity >>>= 1;// Good luck allocating 2 ^ 30 element
    }
    return initialCapacity;
}
```