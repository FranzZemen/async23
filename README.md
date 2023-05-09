# Typescript from CommonJS to ESM

There is no indication that CommonJS will be deprecated any time soon, and there may be many reasons to continue to use
it. However, there are also many reasons to use ECMAScript modules, and the Node.js community is moving in that
direction.

This package is a tutorial that builds up to the objective of deploying TypeScript based code to node.js in both
CommonJS and ECMAScript module formats using the same, unaltered Typescript code and no shims or wrappers.

## Which version of Typescript and Node.js?

Partial compatibility with Node.js advancements, particularly consequences of the package.json exports options and with
respect to variations in module, target and moduleResolution occurred somewhere within the 4.x versions, notably
likely after 4.5. Full compatibility was experienced in the later versions around ~4.8 and resolved by ~4.9.
Unfortunately, the online TypeScript documentation is not version specific, and the documentation is not always
accurate until enough issues have been reported and resolved.

While some combinations work in earlier versions, for the purposes of this blog it is assumed that typescript version is
4.9+.

For Node.js, the assumption is for support as of version 18, but version 16 supported many of the features. Node.js
documentation is more accurate by version than typescript especially in the esoteric areas. Experience has shown that if
Node.js documentation tied to a version said something, it did those things.  (The same is not true in my experience
with the edges of typescript).
What this blog posts covers
In this blog and supporting Github examples we offer solutions for leveraging various typescript compiler options for
the same distribution without writing compatibility coding, shims or other techniques leveraging purely the
documentation in typescript, node.js and to some extent npm. This makes the resulting distribution accessible by all,
whatever module loading and other settings the end user desires.

The blog and code examples describe concepts lightly where needed, and more deeply where necessary to meet the needs of
the casual user as well as those who like to understand the sausage making. However, this is not a blog about using
node.js or typescript (or javascript for that matter). This is also not a blog on how to publish distributions. Where
the blog does not go into detail it is assumed the reader either already knows or can easily find documentation on a
topic.
Pre-Requisites

## Configuration File Inheritance

Since we’re looking to setup code to support multiple target configurations, it's very important to fully understand our
configuration files. tsconfig.json supports inheritance, while package.json does not. However, module resolution in node
can appear to create package.json inheritance for some properties.

### package.json Inheritance

Package.json does not support inheritance.

To prove this, we define a parent directory package.json with a type=module entry. We test with a subdirectory
package.json that first does not contain a module entry and then with one that does. In both cases, the code is
JavaScript attempting esm export/import. In stands to reason that if inheritance worked, the import in the parent
package would work for the subdirecctory package in the first case.

#### Example:  Prove that package.json does not support inheritance

Script file: ./package-json-no-inheritance.sh

Failing sub-example: ./src/package-json/no-inheritance-fail

- [package.json](./src/package-json/no-inheritance-fail/package.json)

Passing sub-example: ./src/package-json/no-inheritance-pass

```
Failing test

```

```

in a parent directory package.json, and do not set type in a subdirectory package.json
in project /src/package-json/no-inheritance-fail. Running

The effect of package.json in folder hierarchies is to reset the current package configuration.

Within a code base both for source (typescript and javascript) and target (javascript)  there may be many package.json
files. For this configuration file, the name must always be package.json. Inheritance works because when a configuration
is needed, node and typescript look for the first instance of that configuration within a package.json file in the
current file folder and work backwards from there. This can be confusing at first, but eventually becomes 2nd nature,
and with the advent of more than just package descriptions, this feature is used in package management and deployment.
Where possible a static definition is encouraged, but It can be necessary for a build step to create, copy or maleate a
package.json.

Example:  https://github.com/FranzZemen/asyn23.git
tsconfig.json Inheritance
This configuration file inheritance is more straightforward - the “extends” entry specifies the ancestor.

Module Loading Options in Node.js
By now it is likely the entire Javascript world knows there are two principal ways to load modules directly, i.e.
through CommonJS, a Node.js invention, or through ECMAScript modules. These module systems are interoperable but not
fully compatible. From a practical point of view, CommonJS is a synchronous module loading system, while ECMAScript is
asynchronous. This has language implications, for example top level await is allowed in ECMAScript modules but not in
CommonJS modules.

For brevity, in this blog we use the terms cjs and mjs to signify CommonJS and ECMAScript module contexts. We use these
terms because .cjs source code is, by standard, always CommonJS loaded javascript and .mjs is always ECMAScript loaded
javascript. The reader is probably aware that these are the javascript forms of the typescript .cts and .mts file types.

There are other types of modules, and other ways to load javascript, but they are becoming rarer in the wild and we
don’t attempt compatibility with them. Then there are bundlers, notably Webpack being arguably the most ubiquitous at
the moment, that basically don’t care about module loading of individual files (or said another way, they are compatible
with all formats).

Modern browsers almost without exceptions load javascript with native mjs module loaders. That said, currently cjs is
not a terminal system - there is no end date to support it. cjs module loading is also alive and well due to the vast
number of libraries out there, and to segments of the world that simply prefers to use require() over import.

Interestingly, the Node.js CLI REPL environment is not compatible with mjs except by way of dynamic imports. In some
ways it makes sense, given the async nature of mjs, though this is probably more a lagging feature than a restriction.

When to use cjs or mjs module loading, and or .cjs/.mjs source
There is no when. Both are available indefinitely as of now.

But there are whys and the whys vary from personal choice to situational. Here are some situations:
You only write javascript (typescript transpiled javascript) for the browser, and you will not use a module bundler.
This corners you into using mjs module loading.
You want the most universally reusable javascript/typescript, in the easiest possible way. Today you might choose cjs,
because of the interoperability advantages of cjs with mjs versus the other way around (though still possible).
You want to easily integrate with older, cjs packages. You can use cjs or mjs without issues.

You will integrate with newer versions of libraries published as mjs only (some packages are not offering backward
support on npm). While you can still do so with cjs, it is easier to integrate with your own mjs files.
You have a mixed bag of requirements. I recommend your target your project to mjs, and leverage cjs as needed. You can
mix module loaders without issues, except that you should not load a cjs and mjs version of a package in the same
project. Code will run, but things like globals and/or package variables (if they are used in the library) could have
different values in different loaders. <TBD Proove it>
There are times when you’ll hit a situation where a library is only available as cjs, and not easily brought into mjs
for various reasons. In those cases you might wrap them within your own cjs, and create your own export from there to be
used in mjs code. For example, if you want to use __dirname with mjs, its simply not available. However, there is a
workaround if you must use the same simbol. You create a .cjs file in the directory called __dirname.cjs with code:
module.exports.dirname=__dirname; Then in the js/ts file you import or require (as the case may be) import {dirname}
from ‘./__dirname.cjs’, or const …

Default Behavior

Interoperability and Importing Basics
Javascript
The only way to import an mjs module from cjs is to use dynamic import:  import() [Ex: TBD].
You can import cjs from mjs using this syntax [Ex: TBD]

Module settings define how you can import .js from .js.
Typescript
Typescript will generally generate appropriate syntax if targeting esm and importing cts.  [EX: TBD] However import
syntax in typescript is still dependent on how cjs exports, given the variability on how that can be done. (
module.exports, exports, export default etc.) [EX: ]
You do need to set the interoperability compilerOption, however, for import to properly generate the appropriate code
from typescript.

Importing .cjs, .cts from .ts, .cts, .mjs
Importing .mjs, .mts from .ts, .cts, .mjs
Import .js, .ts from .ts, .cts., .mts
Target
Module
Global package.json module setting - is it really “global”
Module Resolution
Settings to leverage Node.js exports and imports features
Exports
Conditional Exports
Subpath Exports
Imports
Conditional Imports
Putting it all together to build packages with multiple targets
Project Package.json

Things to potentially include in discussion
lack of __dirname etc. in mjs and how to get around it
typescript screwing transpiling .cts

Scaffolding avoiding simlinks

top level await requires top level async requires modern target and esm

