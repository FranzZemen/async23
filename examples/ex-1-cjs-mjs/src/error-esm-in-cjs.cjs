export function foo() {
    console.log('Should never execute as this is exported as an ESM module within a .cjs file');
}

foo();
