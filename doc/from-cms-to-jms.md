# From CMS to JMS (and more)

While ECMAScript is the language standard, there is no indication that CommonJS will be deprecated
any time soon, and there may be many reasons to continue to use it. However, there are also many
reasons to use ECMAScript modules, and the Node.js community is moving in that direction. Node.js's
own documentation says:

```
ECMAScript modules are the official standard format to package JavaScript code for reuse.
```

At the same time, Node.js's default package behavior for `.js` files is CommonJS...so currently
committed to both approaches.

This tutorial explores the nuanced details in going from CommonJS modules, (henceforth referred to
as `cms` (no ".") to ECMAScript modules (hereforth referred to as `ems`, from a Typescript
perspective, in Node.js. To provide some structure we do that by setting the objective of deploying
to both CommonJS and ECMAScript modules. As part of the exercise, we'll seek to understand support
for package features in Node.js and TypeScript.

## What you'll know after this tutorial

- Differences between commonjs and esm modules, and how to interoperate between these module systems
  at will
- A clear understanding of compilerOptions target, module and moduleResolution that will enable you
  to combine them in seemingly infinite ways to achieve your objectives without guessing
- The ins and outs of package.json and how it impacts modules, module loading, as well as how it can
  help you design code bases including optionality on where your test files go.
- An appreciation for dynamic imports
- Leveraging imports, exports and self-referencing
- Building dual packages/packages with multiple target/module/moduleResolution combinations

## A note on build tooling

For the purposes of this tutorial, the package presents no sophisticated build tooling, given
everyone uses something different. Typical operations in this tutorial are transpilation, file
copying, and package.json manipulation (which we do by storing and copying the transformed version
for the examples at hand). Using this approach will keep the examples simple and easy to follow.

## A note on deploying dual packages

Node.js documentation warns against deploying dual packages from one codebase. The obvious reason is
that should a given client use both packages, any module level state will not be shared between
`cjs` and `esm` modules - as far as Node is concerned they are completely different modules.

The two documented alternatives is to have `.cjs` and `.mjs` entry points (but that leaves some
quirks to the implementation behind the scenes), or simply to have the `esm` part of the package
implemented `cjs` modules, proxied by `.esm` wrappers.

I find both alternatives distasteful. First using `.cjs` and `.mjs`, which are node specific
constructs at the moment and not portable, does little to solve the state issue, it just makes it
more explicitly for the library developer. The library user only sees exports, and has no better
knowledge of it. The second alternative is a hack, and requires the library user to build in `cjs`
so more or less negates any benefits from that perspective.

The true dual package solution from the same code simply requires discipline and the willingness
that in very rare cases a deep dependency might be using the 'other' module loader for the same
package AND that the deep dependency is using module level state AND that state is different AND
that state conflict matters. I can live with that; if you prefer other methods the above
alternatives are there and this tutorial still applies.

## Pre-requisites

### Node.js

Node.js v18+ is recommended. Many of the node features were available as of v.16 or earlier, if you
must operate in an unsupported environment refer to the Node.js documentation, which is pretty good
at identifying concept introduction (as opposed to TypeScript documentation, which is often not in
sync with new codebase features).

Key Node.js features we're covering in this tutorial:

- ECMAScript modules
- module type
- exports
- imports
- self-referencing

### TypeScript

The version of Typescript recommend is at 4.9+ to ensure NodeJS 18+ compatibility. Earlier versions
either did not enable those features, or at the time the documentation did not match the features.
4.9 is "golden" on the integration and documentation.

### TypeScript Composite Projects

If you're not familiar with TypeScript composite projects, it is strongly recommended you
familiarize yourself, though not required for this tutorial. There are several advantages to
composite project not the least of which is to easily transpile multiple subprojects within a
repository, and with the advances in package.json, the ability to leverage those in an easier
manner.

## Reference Documentation

It's recommended to get familiar with the following Node documentation chapters before or after
reading this tutorial. Much of the information there is repeated here in some manner, but those
chapters are the authoritative source:

- [Modules: CommonJS Modules](https://nodejs.org/dist/latest-v18.x/docs/api/modules.html)
- [Modules: ECMAScript Modules](https://nodejs.org/dist/latest-v18.x/docs/api/esm.html)
- [Modules: Packages](https://nodejs.org/dist/latest-v18.x/docs/api/packages.html)

The following TypeScript documentation page is also an important read:

- [ECMAScript Modules in Node.js](https://www.typescriptlang.org/docs/handbook/esm-node.html)

## A note on packages

Depending on how often you build packages, you may only be familiar with the standard format of
having a repos package.json that generally is used as the source for the distribution package.json.

However, package.json and Node.js are much more versatile than that. In many repos the repos
package.json configures the basics, and supports a development experience, for example with bin
commands for development. A distribution package.json may have settings different from the repos
package.json. In both cases, sub-packages may exist that alter code behavior

As we move from `cms` to `ems` there is a strong pressure to better understand package.json ins and
outs.

## Review of CommonJS and ECMAScript Modules

For the rest of the tutorial we are going to introduce some shortcut abbreviations:

| Phrase                                  | Abbreviation Used |
|-----------------------------------------|:-----------------:|
| CommonJS Module Loading/Loader/Loaded   |        cjs        |
| ECMAScript Module Loading/Loader/Loaded |        esm        |
| Node.js 'always' cjs file extension     |       .cjs        |
| Node.js 'always' mjs file extension     |       .mjs        |

Node.js introduced two typescript file extensions, `.cjs` and `.mjs`. The `.cjs` extension must
always implement a `cjs` module, and likewise the `.mjs` extension must always implement an
`esm` module or a run time error will be produced.

Typescript will properly transpile the corresponding `.cts` and `.mts` files to the correct output
and complain if it finds inconsistencies.

`.js` files are ambiguous and can be either `cjs` or `esm` modules, and interpreted depending on the
how the code exports and imports within the file. Thus the `.ts` extension is also ambiguous.
TypeScript, however as of v4.9, does not always provide compilation errors, as we'll see later, even
if the `module` compilerOption conflicts with the configured `package. json`.

## Important properties `cjs` and `esm` modules

TypeScript takes care of the transpilation of `.cts` modules and `.ts` modules to `cjs`
(when `.ts` is configured to produce `cjs` modules), and similarly for `.mts` and `.ts` modules (
when `.ts` is configured to produce `esm` modules).

That said, it is important to understand some of the key properties of these module types in the
Node.js world.

| Property                                                          |                        `cjs`                         |                         `esm`                         |
|-------------------------------------------------------------------|:----------------------------------------------------:|:-----------------------------------------------------:|
| Import Statements                                                 |                       require                        |                        import                         |
| Export Statements                                                 |            module.exports[.blah] = [blah]            |                   export [{[blah]}}                   |
| Import is Synchronous                                             |                         Yes                          |                          No                           |
| Top Level `await`                                                 |                          No                          |                          Yes                          |
| Loading `cjs` modules                                             |                 require or import()                  |           import, createRequire or import()           |
| Loading `esm` modules                                             |                       import()                       |                  import or import()                   |
| Conditional imports (anywhere in code)                            | require or import() for `cjs`<br/>import() for `esm` |                     import() only                     |
| __dirname, __filename etc                                         |                         Yes                          |                          No                           |
| import.meta                                                       |                          No                          |                          Yes                          |
| default for `.js` if package.json `types` does not specify        |                         Yes                          |                          No                           |
| JSON imports                                                      |        const package = require('[blah].json`)        | import package from '[blah].json] assert{type:'json'} |
| Requires relative imports use file extension `.js`, `cjs`, `.mjs` |                       Optional                       |                       Required                        |

### Typescript Import Implications

Always try to use `import` to import in TypeScript. The compilerOption`esModuleInterop` will often
automatically allow that syntax in TypeScript when importing `cjs` modules for both default and
named exports and should be turned on unless you really want to flag at dev time that a module is
commonjs as a way to avoid using it.

There are legacy cases where the module.exports conventions are violated, potentially re-mapping
exports for example. In those cases, TypeScript (and JavaScript) may require the use of the
module.createRequire function, which provides a require function to load`cjs` modules from `esm`
modules. Often if an import error occurs statically in your IDE or through tsc it will likely mean
you should use this technique. This is particularly true of older legacy libraries, when JavaScript
developers tended to be creative with exports.

Using `.ts` extensions is more portable than using `.cts` or `.mts` extensions. This requires
consideration of the package `type` property, along with the `module` and
`moduleResolution` compilerOptions (further discussed laterCR).

### The truth about `cjs` loading `esm` modules

The notion that `cjs` modules cannot load `esm` modules is not entirely true.  `cjs` can load
`esm` through the dynamic import() function. Types can be defined using `import type {blah} from '
blah'` for static typings, and with this line of code removed during compilation. Note that the same
can be done in `esm` modules to create conditional imports.

At first it may feel like a hack, but it is a very useful technique to know, and it is a node.js
feature. Since it is supported by browsers, in addition to general dynamic imports, it can be used
to make code more portable.

For the TypeScript developer, the key is knowing how to import types as well as code
and `import type` syntax is used for that purpose. The `import type` syntax is not supported by
JavaScript, but is removed by tsc.

Depending on whether one is importing the default export or a named export, the syntax is slightly
different.

```typescript
import type {MyType} from 'importIdentifier';

import('importIdentifier').then(({default: MyType}) => {
  // do something with MyType
});
```

Note:  TypeScript complains if you write a module with a dynamic import leveraging `import type`
and also import that type normally using `import`. Design accordingly.

### __dirname and __filename

The module object in `esm` can be used to obtain the file URL and thus derive the same
`__dirname` and `filename` properties as `cjs` modules from the URL. Another 'technique' is to
create a collocated __dirname.cjs and __filename.cjs in the current folder where needed, export the
value and import it into the `esm` module. This is a hack, but it works and providing it here to
show how we can use different module types to achieve various effects.

## Usage of `.js`/`.ts`, `.cjs`/`.cts` and `.mjs`/`.mts` extensions

This tutorial recommends keeping with `.js` and `.ts` extensions for portable coding. Use the other
extensions when you know purposefully that you won't have portable code, and where you specifically
want to override the package's default module system, since specifying the module type extension
will ** always ** result in Node.js attempting to load that module type.

When using `esm` you must include the JavaScript form of the extension in your relative import
statements. For example, if you have a file named `foo.ts` and you want to import it into a file
named  'bar.ts' you must use the following syntax:

```typescript
import {foo} from './foo.js';
```

This is true whether the target import is `esm` or `cjs` and it is always true for dynamic imports
regardless of module type. It is not true within the `cjs` module system, where
`.js` is optional, but for portability reasons, it is recommended to always use the `.js`.  
Modern IDEs complete support this syntax completion and one quickly gets used to it.

## tsconfig.json

In going from 'cjs' to 'esm' one will invariably have multiple tsconfig.json files, some of these
for the same codebase. Typescript is particularly flexible in this regard:  The compiler can be
provided the exact config file to use, no matter what it is named, and config files can be extended.
As we think of dual repos, it will be important to leverage these features to simplify the build
process.

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

## Nested package.json and module resolution algorithm

This information is drawn from - [Modules: Packages](https://nodejs.org/dist/latest-v18.
x/docs/api/packages.html) and enhanced with some practical examples and commentary on implications.

### Nested package.json files

package.json files are, unfortunately, not inheritable and cannot be renamed. This means that if you
have a nested package.json it will override the parent package.json in certain ways that may seem
inexplicable - certainly I have not found solid documentation on the specifics. However, if we
follow the documentation on packages in Node.js, we at least know what its intended behavior is, and
with the help of some testing can understand how it impacts in different ways.

In my exploration of `cjs` to `esm` fully understanding the node.js portions of package.json
completely revolutionized how I think of code packages and code scaffolding.

As far as Node.js is concerned, a package defined by a package.json file applies as may be the case
to all files/folders from the current one to the next package.json file in child directories.  
As we'll discover, this is true in a deployed environment - it is not always true in a development
environment.

#### Implications of nested package.json files

`.js`files are loaded according to the nearest package.json file's `type` field, NOT to the nearest
package.json file that _contains_ a `type` field. If the nearest package.json does not contain this
field, Node.js defaults to `commonjs` module loading. This rule holds true in a development
environment, i.e. when the current package is not deployed to node_modules [Example]().

Typescript honors this rule when properly configured to support Node.js (as we'll see later on, it
doesn't always honor this rule).)

### Module resolution algorithm

Module loading on the other hand doesn't work the way package.json works. If you trace through the
module loading algorithms, a module from another package import is resolved by searching for the
module recursively up through node_modules subdirectories of parent directories all the way back to
root, or it discovers it is within a node_modules directory itself. A relative module is resolved
from the package.json root down, but not further up. Moreover, the presence of sub-directory
package.json files does not inhibit relative imports, but it can still change the default module
loading system, per the previous section.
[Example]()

#### Implications of module resolution algorithms

Say you have code in a parent package that is contains `type=module` in its package.json file.  
Say further that some code in that parent package loads code in a child package that contains
`type=commonjs` in its package.json file. The code in the parent package will load the child not as
an `esm` module, but as a `cjs` module.

This is because of the configuration of the child package, remembering that a package is defined by
the nearest package.json file. The interesting thing here is that the child package.json can define
how its `.js` files are loaded, but it doesn't prevent the parent package from loading it regardless
of what it defines as exports or imports!  Exports and imports, as we'll see later, are entry points
of _deployed_ packages, and control imports to other modules when accessed as a package.
Relative `import` statements can always break through `exports` and `imports`
declarations in child package.json files.

## exports and imports

`exports` and `imports` provide package entry points and work in very much the same way.  
`exports` is for the outside world, while `imports` is for the inside world, i.e. the package. The
package can also import exports using self-referencing (described later).

A nuance is that if a package contains a subdirectory package.json, the imports and exports of that
sub-directory package.json are not available as relative imports to the parent package.  
(If the subdirectory package is installed to the node_modules hierarchy, then the parent package can
import it as a regular package). The parent package can, however point to subdirectory package paths
for its exports, noting that the subdirectory package `types` field will determine the default
module system for `.js` files in that subdirectory.

### exports

Think of exports as mapping logical paths to physical paths. The Node.js documentation does a great
job of explaining the possibilities, and the TypeScript documentation further provides a more
concrete example.

Typically, the construct of an export is:

"[logical path]": "[physical path]"

The logical path must always start with a ".", and the "." logical path means "everything". If you
have other logical paths, you can list them after the "." main path. (You can also not provide a
main path).

From the importer's perspective, they are now import not from a module directly, but form a logical
path. When you think of it, this is no different than importing from "index.js".

```JSON
{
  "name": "my-package",
  "exports": {
    ".": "./dist/index.js",
    "./lib": "./dist/lib"
  }
}
```

```TypeScript
import {foo} from "my-package";
import {bar} from "my-package/lib";
```

### Conditional exports

The [physical path] can include a conditional statement, which indicates to use paths based on
matching conditions. Node.js indicates which conditions are currently supported, and they include:

- import (the caller is using the JavaScript `import` keyword)
- require (the caller is using the JavaScript `require` keyword)
- default (generic fallback, and Node.js indicates it should always be last)
- node (advanced usage)
- node-addons (very advanced usage)

Nested conditions can be used (conditions that then have sub-conditions or subpaths to sub
conditions) (rare to need it).

Moreover, Node.js currently supports typescript with the "types" condition, which must always be
provided first.

In addition to "deno", "browser", "react-native", "development", "production".  
These are beyond the scope of this tutorial.

```JSON
{
  "name": "my-package",
  "exports": {
    ".": {
      "require": "./dist/index.cjs",
      "import": "./dist/index.mjs",
      "default": "./dist/index.js"
    },
    "./lib": {
      "require": "./dist/lib.cjs",
      "import": "./dist/lib.mjs",
      "default": "./dist/lib.js"
    }
  }
}
```

In the above configuration, you see for the first time how to construct a dual-package. The method
here is code intensive - providing different entry implementations for different module loading
systems. It is not recommended for portability reasons.

### Single exports

When there is only one exports, i.e. index.js, exports can be shortened to a name value pair, i.e.

```JSON
{
  "name": "my-package",
  "exports": "./dist/index.js"
}
```

### types

If we want to specify where types are kept other than collocated with JavaScript output, we can
define that for each export.

As we already know, there is a top level `types` field in package.json. When defining `exports`
in its simple form we can use this `types` field.

```JSON
{
  "name": "my-package",
  "types": "./dist/index.d.ts",
  "exports": "./dist/index.js"
}
```

When defining `exports` in its complex form, we can use the `types` field in the exports _for each
sub-path_.

```JSON
{
  "name": "my-package",
  "exports": {
    ".": {
      "types": "./dist/type/index.d.ts",
      "require": "./dist/index.js"
    },
    "./lib": {
      "types": "./dist/lib/types/index.d.ts",
      "require": "./dist/lib/index.js"
    }
  }
}
```

Although not documented, if all the types are in the same types directory, we can use the top
level `types` field for all exports and imports. This currently works but as TypeScript
documentation indicates, it is primarily to support older versions of TypeScript.

### Self-referencing exports

Self referencing is a Node.js feature that allows a file in a package to self-reference it's package
exports and imports for in the `import` construct, rather than using relative paths. It is fully
supported by TypeScript at build time.

Whether one leverages this feature or not for most of the source files is a matter of preference,
noting that some IDEs don't eyt fully bring in the type information when self-referencing is used.
For example as of this writing Webstorm 2023.1 does bring in the type information in general, but
not in every manner (hove over etc.) and color coding may be missing.

One place where self-referencing is immensely useful is for testing scaffolding. T

Consider the following scaffolding:

- repos package
  - project package
    - package.json for project (testing package)
    - src (named "dist" in compiled output)
      - package.json for my-package (distributed package)
      - index.ts
    - test
      - index.test.ts

The project package.json might look like this:

  ```JSON
  {
  "name": "project",
  "exports": {
    "./project": "./dist/index.js",
    "./project/sub-module": "./dist/sub-module.js"
  }
}
  ```

While the my-package package.json might look like this:

  ```JSON
  {
  "name": "my-package",
  "exports": {
    ".": "./dist/index.js"
  }
}
  ```

Now our testing Typescript can import from 'project' or 'project/sub-module' instead of attempting
relative paths to output folders.

  ```TypeScript
import {foo} from 'project';
import {bar} from 'project/sub-module';
  ```

Although this works it is a nuance to note that package and my-package are considered distinct
packages per what we discussed earlier. As we saw, it just so happens that package.json in a
subdirectory does not stop a parent directory package.json from exporting its files - it only
controls the default module type.

The novice may be tempted to put a package.json in the testing directory, but this would be a
breaking mistake. Remembering that exports cannot be inherited by sub-directory packages, and that
they are different packages altogether, the test files would have no knowledge of 'my-package' for
self-referencing.

Likewise, the source files in 'src' have no knowledge of package and only can self-reference to the
my-package level.

### Additional TypeScript support for self-referencing

Interesting, at dev time (source), TypeScript supports package.json exports and imports to `.ts`,
`.mts` and `.cts` files. I have not found documentation on this, but it does work. Of course that
means a build step is needed to remap to `.js` files for runtime package.json.

### imports

We left imports for last, because everything stated for exports works for imports except:

- imports logical paths must start with `#`
- imports are ony usable from self-referencing

For the above reasons, one practice is to use import from package `imports` for tests rather that
package `exports`. It enforces localization to the package, but IMO this is mostly stylistic.

```json
{
  "name": "package",
  "imports": {
    "#project": "./dist/index.js",
    "#project/sub-module": "./dist/sub-module.js"
  }
}
```

  ```TypeScript
import {foo} from '#project';
import {bar} from '#project/sub-module';
  ```

## Important tsconfig.json and package.json compiler options for dual repos

When troubleshooting target, module and moduleResolution compiler options, it is important to
remember that the runtime result will always behave according to Node.js documented rules. Because
of this its important to understand how TypesScript options affect generate JavaScript  
modules

### `target` compilerOption  

Responsible for the generated JavaScript to language specification, but
  does not insert module loading related code(i.e.the transpilation of`import` and `export`
  statements). It is important to remember that it defaults to es3 at least for TypeScript 4.9 and
  earlier.Also, interestingly while `esm` module loading was not available when es3 was predominant,
  it is possible to use`esm` module loading with es3 target, based on settings below.

### `module` compilerOption 

Responsible for the generated`.js` from`.ts``import` and`export` 
  statements.`.cts` and`.mts` will always result`.cjs` and`.mjs` respectively with module 
  loading governed by the convention on those extensions(i.e.the code you write ). Note that in 
  this tutorial we ignore`amd`, `umd` and`system` module loading. A setting of anything other 
  than`commonjs`, `Node16` or`NodeNext` will result`esm` module loading , i.e.`import` 
  and`export` statements, including if the original language spec and Node.js at the time did not support it(see
comment above on es3). Typescript ignores the package.json`type` field, which if set 
  to`commonjs` will cause a runtime error.A setting of`commonjs` will always result in `cjs`
 module loading , i.e.`require`
and`module. exports`.Typescript ignores the package.json`type`
field, which if set to
`module`
will cause a runtime error.A setting of`Node16`
or`NodeNext`
will result in either`esm`
or`cjs`
module loading , and here the TypeScript compiler will look to the package.json`type`
field to determine which, remembering that its absense implies`commonjs`.Note that a value
of`Node16`
or`NodeNext`
will
_not_
result in node.js package.json features such as project self - referencing being recognized by the
typescript compiler(as of 4.9
). It simply influences the generated code for module loading.

`moduleResolution`
compilerOption: responsible for allowing TypeScript to recognize the package.json advanced features
such as project self - referencing.As far as can be seen, that
's pretty much its only use.It does not affect the generated code at all.One might think that the
TypeScript engineers would have been better off simply detecting what was in package.json, and
providing automatic compatibility.The documentation says
"'node16' or 'nodenext' for Node.js’ ECMAScript Module Support from TypeScript 4.7 onwards
", however as far as I can tell tsc supports `.cts`
and`.mts`
and`esm`
module loading without this moduleResolution setting.

`esModuleInterop`
compilerOption: allows TypeScript code to use`import`
to load`cjs`
modules in `esm`
modules.Without it, one has to create a require

function using

module.createRequire, which itself creates non - portable code.There are times when this is still
necessary, as TypeScript cannot infer all cases to`import`
from a`cjs`
module.Given that there is no harm done in using this compilerOption, it is recommended to always
use it for cleaner code.

###

Recommendations

| Purpose | target | module | moduleResolution | esModuleInterop | package.json
type | | -------------- |
:
------
:|:
--------------
:|:
----------------
:|:
--------------------------
:|:
--------------------------------
:| | script | EsNext | None or ESNext | None or NodeNext | true | module(
if package.json present
) | | node library | EsNext | NodeNext | NodeNext | true | module | | web | ESNext | ESNext | Node |
true if `cjs` is supported | module |

##

Putting it all together - deploying dual(or more
)
packages

At this point it may be clear that deploying dual packages involves leveraging conditional
exports.Coming from typescript, we can easily generate the appropriate target for require and
import.

We also know that the default package.json node behavior is to assume`cjs`
module.At this point we realize that with one package.json over a distribution, we cannot achieve a
dual deployment, since node.js will
_always_
result in `cjs`
OR`esm`.So its seems that one solution means that we will need to wrap our code with either`.cts`
or`.mts`
files, which enforce the other condition.Of course, due to what we learned, the choice is to wrap
the code with `.mts`, generating`.mjs` wrappers, since`.mjs`
files can load both
`cjs`
without the use of dynamic`import()`
statements.Not so fast.There is a better way.We also know that a package.json impacts module loading
for all code at its level down - whether it is a deployed package, and that exports paths transcend
sub - packages(you can export child code from a parent package
).

With this knowledge, we can defer the setting of the package.json`type`
field to the last possible level, right before the destination source:

In preparing our package for deployment, we create a deployment package as usual with an incremental
version.Common practice is simply to copy the repos
' package.json with a new version number, but this is
_common practice_
only.In fact, you probably already massage that package.json, for example removing scripts or bin
entries that matter only for development.(You should also take the opportunity to remove all
devDependencies entries and anything else you don
't want in the published version
).

Our distribution package.json will not have a`type`
field.This means that any code in its package will be commonjs, i.e.`cjs`
module loading. But we will not put our code there.Instead, we will define two sub - packages, one
for `cjs` and one for `esm`.For each of these, we only need one property:  `type`, set to the
appropriate value.We already know this will force code at those levels to be`esm`
or`cjs`
respectively.In our distribution package.json, we will set whatever exports we want under the
conditional module loading sub - paths.There are so many options ...

-We can say that require and import always

result in loading their respective generate index.js, where everything is necessary is exported from
the codebase.

- We can be more specific in what modules require and import can

load.

- We can be specific about what modules can be loaded and then pass through require and import
  conditions

. -etc.

-
  *
    * We can also define new distribution logical paths to export additional targets **. For example
      say my default distribution for `esm` is generated from`"module"="esnext"`,
      `"target"="esnext"`, `"moduleResolution"="Node"`
      and for `cjs` is generated from
      `"module"="commonjs"`, `"target"="esnext"`, `"moduleResolution"="NodeNext"`, then these would
      map to my code in the`esm`
      and`cjs`
      sub - packages respectively.But say I also wanted to target a very backward`es3`
      target.In that case I could have an`exports`
      entry called
      `./es3`
      and target that with conditional imports and exports.The distribution scaffolding would look
      something like this
      :

```` 

dist ─┬─ package.json  [Distribution package.json, with no type field, but appropriate exports]
│ ├─ cjs ─┬─ package.json [Output folder for commonjs transpiled code]
types ─┬─ index.d.ts │ index.js │ ├─ mjs ─┬─
package.json [Output folder for esm transpiled code, package.json contains "type"="module]  
│ index.js ├─ es3 ─┬─ cjs ... ├─ mjs ... ├─ bin ─┬─ mjs (supports only mjs

````

### Development Consequences

If you have a simple project where all your code uses relative imports, you don't need any exports
in your repos package.json.

You will however need to choose whether your repos package.json will be `cjs` or `esm` for
development purposes. You can use the lessons in this tutorial along with symbolic links to create a
dev environment that supports both ... but there is little benefit to doing so and it is overly
complex Instead, see testing consequences.

#### Using self-reference imports or #imports sub-paths

There are times when you may prefer to use self-referencing imports or #imports entries. For
example, you may have a `bin` folder in your package.json at the same level as the rest of your
generated code. Leveraging either self-reference imports or #import entries makes things clean:

````typescript
import {api} from 'my-package/bin';
````

Package.json entry for development:

````json
{
  "exports": {
    "./bin": {
      "types": "./dist/bin/types/index.d.ts",
      "default": "./dist/bin/index.mjs"
    }
  }
}
````

Package.json entry for distribution

````json
{
  "exports": {
    "./bin": {
      "types": "./bin/types/index.d.ts",
      "default": "./bin/index.mjs"
    }
  }
}
````

Using this technique, however, requires a successful tsc compile so that the self-reference works.
This is usually not a problem with auto-compile IDE settings. But there is a better way:

````json
{
  "exports": {
    "./bin": {
      "default": "./bin/index.mts"
    }
  }
}
````

TypeScript can understand exports that point to TypeScript, negating the need for a successful
compile.

### Testing consequences

## The end result (one version, at least)

If you don't care about the details or the optionality of what one can do, and just want to set up a
dual repos quickly as possible, this section is for you.

Setup your build system to result in the following distribution scaffolding as follows:

````
dist ─┬─ package.json  
      │
      ├─ cjs ─┬─ package.json
      │
      ├─ mjs ─┬─ package.json
      │
      ├─ test

````

#### Example:  Prove that package.json does not support inheritance

Script file: ./package-json-no-inheritance.sh

Failing sub-example: ./src/package-json/no-inheritance-fail

- [parent directory package.json](src/package-json/[js]-no-inheritance-fail/package.json)
- [child directory package.json](src/package-json/[js]-no-inheritance-fail/sub-package/package.json)

Passing sub-example: ./src/package-json/no-inheritance-pass

- [parent directory package.json](src/package-json/[js]-no-inheritance-pass/package.json)
- [child directory package.json](src/package-json/[js]-no-inheritance-pass/sub-package/package.json)

Script output:

```shell    
--- START package.json does not support inheritance
--- In the first project, a super directory package.json has type=module
--- but the sub directory package.json does not have type=module
--- The result is a run time exception pointing to the fact the .js module loading
--- is inconsistent.

(node:26659) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
/home/franzzemen/dev/async23/src/package-json/no-inheritance-fail/sub-package/esm-import.js:1
import {esmExport} from "./esm-export";
^^^^^^

SyntaxError: Cannot use import statement outside a module
    at Object.compileFunction (node:vm:360:18)
    at wrapSafe (node:internal/modules/cjs/loader:1088:15)
    at Module._compile (node:internal/modules/cjs/loader:1123:27)
    at Module._extensions..js (node:internal/modules/cjs/loader:1213:10)
    at Module.load (node:internal/modules/cjs/loader:1037:32)
    at Module._load (node:internal/modules/cjs/loader:878:12)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:81:12)
    at node:internal/main/run_main_module:23:47

Node.js v18.12.1
---
--- The second project adds type=module to the sub directory package.json
--- The result is a pass with code properly running

Code output --> module properly exported as esm due to nearest package.json type=module

--- END package.json does not support inheritance^C
franzzemen@penguin:~/dev/async23$ ./package-json-no-inheritance.sh
--- START package.json does not support inheritance
--- In the first project, a super directory package.json has type=module
--- but the sub directory package.json does not have type=module
--- The result is a run time exception pointing to the fact the .js module loading
--- is inconsistent.

(node:26678) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
/home/franzzemen/dev/async23/src/package-json/no-inheritance-fail/sub-package/esm-import.js:1
import {esmExport} from "./esm-export";
^^^^^^

SyntaxError: Cannot use import statement outside a module
    at Object.compileFunction (node:vm:360:18)
    at wrapSafe (node:internal/modules/cjs/loader:1088:15)
    at Module._compile (node:internal/modules/cjs/loader:1123:27)
    at Module._extensions..js (node:internal/modules/cjs/loader:1213:10)
    at Module.load (node:internal/modules/cjs/loader:1037:32)
    at Module._load (node:internal/modules/cjs/loader:878:12)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:81:12)
    at node:internal/main/run_main_module:23:47

Node.js v18.12.1
---
--- The second project adds type=module to the sub directory package.json
--- The result is a pass with code properly running

Code output --> module properly exported as esm due to nearest package.json type=module

--- END package.json does not support inheritance
```

### The appearance of package.json inheritance

I have come across a couple of cases that can give the appearance of package.json inheritance. The
first is with respect to module resolution in node.js in combination with self-referencing
exports/imports and separately with respect to exports and imports declarations.

#### Appearance of inheritance due to module resolution and self-referencing

In the following example, lets assume that we have a package.json that exports everything through
index.js. It stands to follow that any source in that package can import from the package name. (In
fact if the exports contained a subdirectory export, source could import from the package name and
the subdirectory name.)

Let us also assume that the package.json does not define type=module, because for whatever reason we
want some .js files to be commonjs modules and some esm modules. Normally we would simply use .cjs
and .mjs extensions to distinguish the module loading required.

But what if we could place a package.json at the root of the commonjs files with type=commonjs and
one at the root of the esm files with type=module? Would that not give us what we are looking for?
The answer is yes, sort of.

Ah! we have inheritance of package.json! Not so fast. The answer is no.

For JavaScript, and the entry point being the parent directory package, node.js encounters the
exports and accesses that source directly. In doing so it encounters the sub-direcgtory package.json

There are two things happening at once. First, w

While the configuration is different, the reason for tha illusion is the same.

Self-referencing is the ability for a module to import itself. This is a useful technique in many
cases. Instead of using relative imports, self-referencing allows a module to import/require from
its own package name as if it was in node_modules, noting the nuances related to how this works
depending on what the package exports.

Typically

For both commonjs and esm module loading, node.js will climb the directory tree to root to find the
closest node_modules fora an imported package. Under certain circumstances, this can give the
appearance of package.json inheritance.

Example:  https://github.com/FranzZemen/asyn23.git
tsconfig.json Inheritance This configuration file inheritance is more straightforward - the
“extends” entry specifies the ancestor.

Module Loading Options in Node.js By now it is likely the entire Javascript world knows there are
two principal ways to load modules directly, i.e. through CommonJS, a Node.js invention, or through
ECMAScript modules. These module systems are interoperable but not fully compatible. From a
practical point of view, CommonJS is a synchronous module loading system, while ECMAScript is
asynchronous. This has language implications, for example top level await is allowed in ECMAScript
modules but not in CommonJS modules.

For brevity, in this blog we use the terms cjs and mjs to signify CommonJS and ECMAScript module
contexts. We use these terms because .cjs source code is, by standard, always CommonJS loaded
javascript and .mjs is always ECMAScript loaded javascript. The reader is probably aware that these
are the javascript forms of the typescript .cts and .mts file types.

There are other types of modules, and other ways to load javascript, but they are becoming rarer in
the wild and we don’t attempt compatibility with them. Then there are bundlers, notably Webpack
being arguably the most ubiquitous at the moment, that basically don’t care about module loading of
individual files (or said another way, they are compatible with all formats).

Modern browsers almost without exceptions load javascript with native mjs module loaders. That said,
currently cjs is not a terminal system - there is no end date to support it. cjs module loading is
also alive and well due to the vast number of libraries out there, and to segments of the world that
simply prefers to use require() over import.

Interestingly, the Node.js CLI REPL environment is not compatible with mjs except by way of dynamic
imports. In some ways it makes sense, given the async nature of mjs, though this is probably more a
lagging feature than a restriction.

When to use cjs or mjs module loading, and or .cjs/.mjs source There is no when. Both are available
indefinitely as of now.

But there are whys and the whys vary from personal choice to situational. Here are some situations:
You only write javascript (typescript transpiled javascript) for the browser, and you will not use a
module bundler. This corners you into using mjs module loading. You want the most universally
reusable javascript/typescript, in the easiest possible way. Today you might choose cjs, because of
the interoperability advantages of cjs with mjs versus the other way around (though still possible).
You want to easily integrate with older, cjs packages. You can use cjs or mjs without issues.

You will integrate with newer versions of libraries published as mjs only (some packages are not
offering backward support on npm). While you can still do so with cjs, it is easier to integrate
with your own mjs files. You have a mixed bag of requirements. I recommend your target your project
to mjs, and leverage cjs as needed. You can mix module loaders without issues, except that you
should not load a cjs and mjs version of a package in the same project. Code will run, but things
like globals and/or package variables (if they are used in the library) could have different values
in different loaders. <TBD Proove it>
There are times when you’ll hit a situation where a library is only available as cjs, and not easily
brought into mjs for various reasons. In those cases you might wrap them within your own cjs, and
create your own export from there to be used in mjs code. For example, if you want to use __dirname
with mjs, its simply not available. However, there is a workaround if you must use the same simbol.
You create a .cjs file in the directory called __dirname.cjs with code:
module.exports.dirname=__dirname; Then in the js/ts file you import or require (as the case may be)
import {dirname} from ‘./__dirname.cjs’, or const …

Default Behavior

Interoperability and Importing Basics Javascript The only way to import an mjs module from cjs is to
use dynamic import:  import() [Ex: TBD]. You can import cjs from mjs using this syntax [Ex: TBD]

Module settings define how you can import .js from .js. Typescript Typescript will generally
generate appropriate syntax if targeting esm and importing cts.  [EX: TBD] However import syntax in
typescript is still dependent on how cjs exports, given the variability on how that can be done. (
module.exports, exports, export default etc.) [EX: ]
You do need to set the interoperability compilerOption, however, for import to properly generate the
appropriate code from typescript.

Importing .cjs, .cts from .ts, .cts, .mjs Importing .mjs, .mts from .ts, .cts, .mjs Import .js, .ts
from .ts, .cts., .mts Target Module Global package.json module setting - is it really “global”
Module Resolution Settings to leverage Node.js exports and imports features Exports Conditional
Exports Subpath Exports Imports Conditional Imports Putting it all together to build packages with
multiple targets Project Package.json

Things to potentially include in discussion lack of __dirname etc. in mjs and how to get around it
typescript screwing transpiling .cts

Scaffolding avoiding simlinks

top level await requires top level async requires modern target and esm
