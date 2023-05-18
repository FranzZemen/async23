# Example 1: .cjs and .mjs files

In this example, we have a couple of files, 'error-esm-in-cjs.cjs' and 'error-esm-in-cts.cts' to 
illustrate a couple of points.

Starting with the 'error-esm-in-cjs.cjs' file, we have a file that is a CommonJS module by 
definition, but the module related code is `esm` code (the export keyword).  This will cause a 
runtime error:

```shell
node src/error-esm-in-cjs.cjs
```

Produces the expected error:

```shell
PS H:\dev\async23\examples\ex-1-cjs-mjs> node src/error-esm-in-cjs.cjs
(node:22912) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
H:\dev\async23\examples\ex-1-cjs-mjs\src\error-esm-in-cjs.cjs:1
export function foo() {
^^^^^^

SyntaxError: Unexpected token 'export'
    at Object.compileFunction (node:vm:360:18)
    at wrapSafe (node:internal/modules/cjs/loader:1088:15)
    at Module._compile (node:internal/modules/cjs/loader:1123:27)
    at Module._extensions..js (node:internal/modules/cjs/loader:1213:10)
    at Module.load (node:internal/modules/cjs/loader:1037:32)
    at Module._load (node:internal/modules/cjs/loader:878:12)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:81:12)
    at node:internal/main/run_main_module:23:47

Node.js v18.12.1
```

The same would hold in the inverse case, where we have a file that is an ESM module by 
definition with a `.mjs` extension, but uses `cjs` code (the `require` or `exports` keywords). 
As an exercise, write the code that does this.

The second file is a correctly written typescript file that should compile to a CommonJS module 
system.  The example ships with the tsconfig.json file properly configured to do that.  It 
contains a module setting of Node16 or NodeNext.

Compile it:

```shell
tsc -p ./src/tsconfig.json
```

Examine the produce .cjs file, it will contain the correct `cjs` module related code.  

As an aside, notice since we have the `allowJS` compilerOption set, notice that typescript 
"fixed" the .cjs file we had in the source and replaced the export statement.  That's a nice 
side effect.

But, if we use any other module setting, such as ESNext, the output .cjs file will wrongly 
emitted as `esm` code.  It would be nice if in versions later thant TypeScript 4.9 the compiler 
always emitted the right code irrespective of the module setting for these special file extensions.


