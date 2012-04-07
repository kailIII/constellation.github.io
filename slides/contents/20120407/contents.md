ES.next the corner cases
========================

---


主題
====

- おそらく, 皆さんがES.nextの主要機能についてしゃべり尽くしていると思うので, corner casesについて.


---


ConstDeclaration
================

---

ConstDeclaration
================

特徴

- initializer必須
- block scoped
- immutable binding


- [拙blog](http://d.hatena.ne.jp/Constellation/20111201/1322678350)
- [harmony:const](http://wiki.ecmascript.org/doku.php?id=harmony:const)

---

initializer必須
===============

- uninitializedな状態を持たないため
- BNF見るだけでは, initializerなくても行けそうですが
- ES6 draft仕様の特徴
  - BNFだけじゃなくて, semanticsも見なければいけないようになった
- section 12.2.1 Static Semantics

> LexicalBinding : BindingIdentifier
> 
> It is a Syntax Error if the BindingIdentifier if IsConstantDeclaration of the LexicalDeclaration containing this production is true.

---

block scoped
============

- これもuninitializedな状態を持たないため
- staticに解析可能


        !javascript
        {
          const V = 20;
        }
        console.assert(typeof V === 'undefined');

- もしもblock scopedでなければ,

        !javascript
        if (cond) {
          const V = 20;
        }
        // ここでVがuninitializedか, initializedかどうかは
        // runtimeにしかわからない

- すると, constな変数に対して, initializedかどうかのflagが必要になり, 高コスト実装になる.

---

immutable binding
=================

- ConstDeclarationの素晴らしさ
- section 11.13 Runtime Semantics

> It is a Syntax Error if the LeftHandSideExpression is an Identifier that statically resolves to a declarative environment record binding and the resolved binding is an immutable binding.


- つまりですね,


        !javascript
        const V = 20;
        V = 30;  // これがSyntaxErrorになる!


- SyntaxErrorはearly error (section 16)なので, parse phaseで通知される

---

Egal Operator
=============

---

Egal Operator
=============

- [egal operator](http://wiki.ecmascript.org/doku.php?id=harmony:egal)

        !javascript
        i is j;
        k isnt l;

- is / isnt

---

Semantics
=========

- より値の同一性に重きをおいたequal
- NaN is NaN => true
- +0 is -0 => false
- Map / Setにおけるequalityの基盤
- Strict Equality Algorithm(=== / !==)と異なる
    - CoffeeScript大敗北...
- 実は昔からあるSameValue algorithmがuser levelで見えるようになったもの
    - SameValue algorithmはproperty代入の同一性検査とかに使われていました
    - writableがfalseでSameValueじゃなければrejectとかそういう

---

Contextual Keyword
==================

- このis / isntはContextual Keyword
- これにかぎらず, ES.nextではStatement先頭以外のkeywordは大体contextual keyword
    - ofとか
    - Statement先頭のものは, 変数名と区別がつかないので, keywordにせざるを得ない
    - moduleとかはkeyword
    - break the webのよかん...
- つまり, keywordではなく, 文脈依存でkeywordのような扱われ方をするということ
- 例えば, is / isntはcontextual keywordなので

        !javascript
        var function = 20;  // これはkeywordなのでだめだけど
        var is = 20;  // これはOK

- なので, keyword増えるわけではないので, 互換性の面からは安心

---

TriangleLiteral
===============

---

TriangleLiteral
===============

- これです

        !javascript
        var DerivedArray = Array <| function DerivedArray() {
          return DerivedArray.prototype <| [];
        };

- あんまり誰も触れたがらない魔境
- [proto operator](http://wiki.ecmascript.org/doku.php?id=harmony:proto_operator)

---

TriangleLiteral
===============

- 左辺のobjectを右辺のliteralの[[Prototype]]に割り当てる
- Object.createがあるじゃないですか?
    - Arrayなど, Object以外が作れる
    - Derived Arrayが仕様の範疇でできる
- なんでLiteralしか来れない?
    - おそらく, 静的に確定させたいから
    - [[Prototype]]が書き換わると, MapのTransitが起き, inline cacheが破滅するので, あんまり途中で変えたくない
- ただし, 左辺のObjectがprototype propertyを持ち, 右辺にfunctionが来た場合は挙動が異なる

---

Inheritance
===========

- 継承

        !javascript
        var Derived = Base <| function Derived() {
        };

- BaseがDerivedの[[Prototype]]になる (ここまでは一緒)
- Base.prototypeを[[Prototype]]にもつObjectが生成され, これがDerived.prototypeに設定される
- さっぱり言えば, 継承になるわけです

---

その他
======

---

VarDeclaredNames
================

- duplicateな変数名purge機構

    !javascript
    function test(a) {
      var a = 20;
    }

- こういうのがSyntaxErrorになる機構
- まだ完全ではない

---

Date with NaN
=============

- new Date(NaN).toString()の結果が, "Invalid Date"という文字列を返すようにと規定
- section 15.9.5.2

> If this time value is NaN, the String value is "Invalid Date"

---

LHS
===

- section 11.13
- LHSについて改訂
- LHSがPrimaryExpression : ( Expression ) についてLeftHandSideExpressionじゃなくなるとout


        !javascript
        (1, 2, 3) = 20;


- とかがSyntaxErrorに (ES5でははReferenceError)

---

draft bug
=========

- ES.next draftのbug
- destructuring-assignmentについて
- destructuring-assignmentはAssignmentBindingPatternについては以下の文法を認めている

        !javascript
        ({ responseText }) = res;

- section 11.13 Runtime Semantics

> If LeftHandSideExpression is neither an ObjectLiteral nor an ArrayLiteral then

- destructuring-assignmentは一回ObjectLiteral or ArrayLiteralとしてparseしてみて, その後, 再解釈という形式を取る
- なので上記の形式は,

        !javascript
        ({ responseText })

- がObjectLiteralとしてparse不可能なので, これが有効になるpathがない

---

for-in with initializer
=======================

- ひっそりと消えました
- in ES5, following script is valid

        !javascript
        for (var i = 20 in []) {
        }

- for-inのVariableDeclarationはinitializerがとれた
- ES.next draftでは取れなくなった

----

questions
=========
