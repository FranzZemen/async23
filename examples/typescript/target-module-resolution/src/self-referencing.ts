import {helloWorld} from 'target-module-resolution/exported';

export function selfReferencing():string {
    helloWorld();
    return 'Self referencing';
}
