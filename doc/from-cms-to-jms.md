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
perspective. To provide some structure we do that by setting the objective of deploying to both
CommonJS and ECMAScript modules, but with a caveat - using only one TypeScript codebase, with no
shims or proxy code.

A small note:  Web browsers already use `esm` module loading. Packagers such as Webpack make this
transparent to the developer.

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

I find both alternatives distasteful. First `.cjs` and `.mjs` are node specific constructs at the
moment, and I tend to want to write portable code (to the web). Second, I don't like the proxy-fix
solution. I can't get TypeScript to auto generate that, meaning I have to have a codebase for it.

The true dual package solution from the same code simply requires discipline and the willingness
that in very rare cases a deep dependency might be using the 'other' module loader for the same
package AND that the deep dependency is using module level state AND that state is different AND
that state conflict matters. I can live with that; if you prefer other methods the above
alternatives are there and this tutorial still applies.

## Pre-requisites

The version of node should cover the functionality from node desired. Except for the oldest of
legacy projects this should not an issue as current stable version is 18+. We'll also see that
proper module and moduleResolution settings make code version proof to future Node releases.  
For legacy projects, advanced package.json features began appearing around Node 16 and you're out of
luck for those features if you are using something earlier.

The version of Typescript recommend is at 4.9+ to ensure NodeJS 18+ compatibility. Earlier
versions (for example 4.6) did not fully enable some of the features, and the documentation lagged
for severa minor versions. However, 4.9 is "golden" on the integration and documentation.

If you're not familiar with TypeScript composite projects, it is strongly recommended you
familiarize yourself. There are several advantages to composite project not the least of which is to
easily transpile multiple subprojects within a repository, however this topic is beyond the scope of
the tutorial.

It's recommended to get familiar with the following Node documentation chapters before or after
reading this tutorial. Much of the information there is repeated here in some manner, but those
chapters are the authoritative source:

- [Modules: CommonJS Modules](https://nodejs.org/dist/latest-v18.x/docs/api/modules.html)
- [Modules: ECMAScript Modules](https://nodejs.org/dist/latest-v18.x/docs/api/esm.html)
- [Modules: Packages](https://nodejs.org/dist/latest-v18.x/docs/api/packages.html)

The following TypeScript documentation page is also an important read:

- [ECMAScript Modules in Node.js](https://www.typescriptlang.org/docs/handbook/esm-node.html)

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

Typescript will properly transpile the corresponding `.cts` and `.mts` files to the correct output.

`.js` files are ambiguous and can be either `cjs` or `esm` modules, and interpreted depending on the
code the contain to import and export modules, among other things. Thus the `.ts` is also ambiguous.
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

### TypeScript Implications

Always try to use `import` in TypeScript. The compilerOption `esModuleInterop` will often
automatically allow that syntax in TypeScript when importing `cjs` modules for both default and
named exports.

There are legacy cases where the module.exports conventions are violated, potentially re-mapping
exports for example. In those cases, TypeScript (and JavaScript) will require the use of the
module.createRequire function, which provides a require function to load`cjs` modules. In practice,
Lif you an import error it will likely mean you should use this technique. If it still fails, there
are other issues with your code or environment.

The notion that `cjs` modules cannot load `esm` modules is not entirely true.  `cjs` can load
`esm` through the dynamic import() function. Types can be defined using `import type {blah} from '
blah'` for static typings, and with this line of code removed during compilation. Note that the 
same can be done in `esm` modules to create conditional imports.

Using `.ts` extensions is more portable than using `.cts` or `.mts` extensions. This requires 
consideration of the package `type` property, along with the `module` and 
`moduleResolution` compilerOptions (further discussed laterCR).

### __dirname and __filename

The module object in `esm` can be used to obtain the file URL and thus the derive the same 
`__dirname` and `filename` properties as `cjs` modules. Another 'technique' is to create a 
collocated __dirname.cjs and __filename.cjs in the current folder where needed, export the value 
and import it into the `esm` module. This is a hack, but it works and providing it here to show 
how we can use different module types to achieve various effects.



## Usage of `.js`/`.ts`, `.cjs`/`.cts` and `.mjs`/`.mts` extensions

One motivation for this tutorial is to continue to use `.js` and more importantly `.ts` extensions
and share that source without concern as to where it is used (client side, `esm` or `cjs`).

Node.js documents a known risk with taking this approach for dual repos. A client could
inadvertently use both the `cjs` and `esm` versions of a package, and the behavior would be
potentially unpredictable. At the very least, module level state (var, let, const) could be
different between the two.

This tutorial rationalizes this risk as follows. If two different libraries leverage a dual package
through `cjs` and `esm` respectively, the internal state of each and that of the client which may be
using one or the other should not matter in most cases if inner package exports are not
re-exported (doing so is rare). The documentation of the library in question (the client in this
case) should clearly state that the library is dual and that the client should not use both.

The recommendation to use `.js` and `.ts` extensions is a recommendation only. You can still use the
principles of this tutorial and write only `.cjs` and `.mjs` files.

Remembering that irrespective of package.json `type` field setting `.cjs` and `.mjs` files are
always module loaded per their extension. There are times when writing code you may want to actually
enforce one or the other regardless of the surrounding package.json `type` field setting, and that's
fine. JavaScript will even allow for an inline require within a `esm` loaded module.

## tsconfig.json Inheritance

tsconfig.json can explicitly inherit from another tsconfig.json file. This is a powerful feature
that we will leverage. The following is a simple example of inheritance:

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

package.json files are, unfortunately, not inherited. This means that if you have a nested
package.json it will override the parent package.json. However, this 'feature' can be taken
advantage of in interesting ways, and we do that in this tutorial.

As far as Node.js is concerned, a package defined by a package.json file applies as may be the case
to all files/folders from the current one to the next package.json file.

Code that is in a child package may not refer to code in a parent package, i.e. one cannot import
from further up than one's own package.json file location. However, code in a parent package may
access code in a child package [Example]().

#### Implications of nested package.json files

`.js`files are loaded according to the nearest package.json file's `type` field, NOT to the nearest
package.json file that _contains_ a `type` field. If the nearest package.json does not contain this
field, Node.js defaults to `commonjs` module loading[Example]().

### Module resolution algorithm

Module loading on the other hand doesn't work the way package.json works. If you trace through the
module loading algorithms, a module from another package import is resolved by searching for the
module recursively up through node_modules subdirectories of parent directories all the way back to
root, or it discovers it is within a node_modules directory itself. A relative module is resolved
from the package.json root down, but not further up. The presence of new package.json files does not
inhibit relative imports. [Example]()

#### Implications of module resolution algorithms

Say you have code in a parent package that is contains `type=module` in its package.json file.  
Say further that some code in that parent package loads code in a child package that contains
`type=commonjs` in its package.json file. The code in the parent package will load the child not as
an `esm` module, but as a `cjs` module. This is because of the configuration of the child package,
remembering that a package is defined by the nearest package.json file. The interesting thing here
is that the child package can define how its `.js` files are loaded, but it doesn't prevent the
parent package from loading it! This is a powerful feature that we will leverage later on, when we
look at package exports and imports.

## exports and imports

If you're only attempting leveraging exports and imports from TypeScript 4.9 onwards (or
thereabouts), consider yourself lucky. Earlier versions were not consistent with node.js package.
json changes, nor was the documentation clear. There were also bugs, such as the insertion of
`export {}`into .cjs from transpilation of .cts, which was considered a "feature" at the time.

`exports` and `imports` were in very much the same way.  `exports` is for the outside world,
while `imports` is for the inside world, i.e. the package. The package can also import using
self-referencing.

| Feature                               | exports | imports | 
|---------------------------------------|---------|---------|
| can begin with conditional expression |         |         |
|                                       |         |         |
|                                       |         |         |

The node.js and TypeScript documentation do a good job of explaining exports and imports, with a
logical path mapping to a physical path relative to the package.json file, potential with a
conditional mapping in the mix.

One quirk is that exports have no effect in relative imports that cross package lines. They only
take effect in the context of an installed node_modules dependency. This is a quirk because it is
not consistent with the `type`
field, which does have an effect on relative imports that cross package lines.

This quirk can cause issues, because it means that exports and imports are not of use until the
package is installed. This quirk will show up as an issue later in this tutorial.

### Did you know that you can export `.ts` files?

## Important tsconfig.json and package.json compiler options for dual repos

When troubleshooting target, module and moduleResolution compiler options, it is important to
remember that the runtime result will always behave according to Node.js documented rules. If
something throws a module not found error or similar, its because `tsc` is transpiling something
inconsistent.

`target` compilerOption:  responsible for the generated JavaScript to language specification, but
does not insert module loading related code (i.e. the transpilation of `import` and `export`
statements).

It is important to remember that it defaults to es3 at least for TypeScript 4.9 and earlier. Also,
interestingly while `esm` module loading was not available when es3 was predominant, it is possible
to use `esm` module loading with es3 target, based on settings below.

`module` compilerOption: responsible for the generated `.js` from `.ts` `import` and `export`
statements.  `.cts` and `.mts` will always result `.cjs` and `.mjs` respectively with module loading
governed by the convention on those extensions (i.e. the code you write). Note that in this tutorial
we ignore `amd`, `umd` and `system`module loading.

A setting of anything other than `commonjs`, `Node16` or `NodeNext` will result `esm` module
loading, i.e. `import` and `export` statements, including if the original language spec and Node. js
at the time did not support it (see comment above on es3). Typescript ignores the package.json`type`
field, which if set to `commonjs` will cause a runtime error.

A setting of `commonjs` will always result in `cjs` module loading, i.e. `require`
and `module. exports`. Typescript ignores the package.json `type` field, which if set to
`module` will cause a runtime error.

A setting of `Node16` or `NodeNext` will result in either `esm` or `cjs` module loading, and here
the TypeScript compiler will look to the package.json `type` field to determine which, remembering
that its absense implies `commonjs`.

Note that a value of `Node16`or  `NodeNext` will _not_ result in node.js package.json features such
as project self-referencing being recognized by the typescript compiler (as of 4.9). It simply
influences the generated code for module loading.

`moduleResolution` compilerOption: responsible for allowing TypeScript to recognize the package.
json advanced features such as project self-referencing. As far as can be seen, that's pretty much
its only use. It does not affect the generated code at all. One might think that the TypeScript
engineers would have been better off simply detecting what was in package.json, and providing
automatic compatibility. The documentation says "'node16' or 'nodenext' for Node.js’ ECMAScript
Module Support from TypeScript 4.7 onwards", however as far as I can tell tsc supports `.cts`
and `.mts` and `esm` module loading without this moduleResolution setting.

`esModuleInterop` compilerOption: allows TypeScript code to use `import` to load `cjs` modules
in `esm` modules. Without it, one has to create a require function using module.createRequire, which
itself creates non-portable code. There are times when this is still necessary, as TypeScript cannot
infer all cases to `import` from a `cjs` module. Given that there is no harm done in using this
compilerOption, it is recommended to always use it for cleaner code.

### Recommendations

| Purpose      | target |     module     | moduleResolution |      esModuleInterop       |        package.json type         |
|--------------|:------:|:--------------:|:----------------:|:--------------------------:|:--------------------------------:|
| script       | EsNext | None or ESNext | None or NodeNext |            true            | module (if package.json present) |
| node library | EsNext |    NodeNext    |     NodeNext     |            true            |              module              |
| web          | ESNext |     ESNext     |       Node       | true if `cjs` is supported |              module              |

## Putting it all together - deploying dual (or more) packages

At this point it may be clear that deploying dual packages involves leveraging conditional exports.
Coming from typescript, we can easily generate the appropriate target for require and import.

We also know that the default package.json node behavior is to assume `cjs` module. At this point we
realize that with one package.json over a distribution, we cannot achieve a dual deployment, since
node.js will _always_ result in `cjs` OR `esm`.

So its seems that one solution means that we will need to wrap our code with either `.cts`
or  `.mts` files, which enforce the other condition. Of course, due to what we learned, the choice
is to wrap the code with `.mts`, generating `.mjs` wrappers, since `.mjs` files can load both
`cjs` without the use of dynamic `import()` statements.

Not so fast. There is a better way. We also know that a package.json impacts module loading for all
code at its level down - whether it is a deployed package, and that exports paths transcend
sub-packages (you can export child code from a parent package).

With this knowledge, we can defer the setting of the package.json `type` field to the last possible
level, right before the destination source:

In preparing our package for deployment, we create a deployment package as usual with an incremental
version. Common practice is simply to copy the repos' package.json with a new version number, but
this is _common practice_ only. In fact, you probably already massage that package.json, for example
removing scripts or bin entries that matter only for development.  (You should also take the
opportunity to remove all devDependencies entries and anything else you don't want in the published
version).

Our distribution package.json will not have a `type` field. This means that any code in its package
will be commonjs, i.e. `cjs`   module loading. But we will not put our code there.  
Instead, we will define two sub-packages, one for `cjs` and one for `esm`. For each of these, we
only need one property:  `type`, set to the appropriate value. We already know this will force code
at those levels to be `esm` or `cjs` respectively.

In our distribution package.json, we will set whatever exports we want under the conditional module
loading sub-paths. There are so many options...

- We can say that require and import always result in loading their respective generate index.js,
  where everything is necessary is exported from the codebase.
- We can be more specific in what modules require and import can load.
- We can be specific about what modules can be loaded and then pass through require and import
  conditions.
- etc.
- ** We can also define new distribution logical paths to export additional targets **. For example
  say my default distribution for `esm` is generated from `"module"="esnext"`,
  `"target"="esnext"`, `"moduleResolution"="Node"` and for `cjs` is generated from
  `"module"="commonjs"`, `"target"="esnext"`, `"moduleResolution"="NodeNext"`, then these would map
  to my code in the `esm` and `cjs` sub-packages respectively. But say I also wanted to target a
  very backward `es3` target. In that case I could have an `exports` entry called
  `./es3` and target that with conditional imports and exports.

The distribution scaffolding would look something like this:

```` 
dist ─┬─ package.json  [Distribution package.json, with no type field, but appropriate exports]
      │
      ├─ cjs ─┬─ package.json [Output folder for commonjs transpiled code]
                 types ─┬─ index.d.ts
      │          index.js
      │
      ├─ mjs ─┬─ package.json [Output folder for esm transpiled code, package.json contains "type"="module]  
      │
                 index.js
      ├─ es3  ─┬─ cjs ...
               ├─ mjs ...
      ├─ bin  ─┬─ mjs (supports only mjs 
     
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
