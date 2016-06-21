function isFunction(x:any ) : x is Function {
    return 'function' == typeof x
}

function* sequence<T>(_from: T | (() => T), next: (x: T) => T, completed: (x: T) => boolean) {

    let value: T = isFunction(_from) ? _from() : _from

    while (!completed(value)) {
        value = yield next(value);
    }
}

function* where<T>(iter: IterableIterator<T>, filter: (x: T) => boolean): IterableIterator<T> {
    for (let value of iter) {
        if (filter(value)) {
            yield value;
        }
    }
}

function* select<T, TR>(iter: IterableIterator<T>, f: (x: T) => TR): IterableIterator<TR> {
    for(let x of iter){
        yield f(x);
    }
}

function* take<T>(iter: IterableIterator<T>, n: number): IterableIterator<T> {
    let count = 0;
    for (var x of iter) {
        if (count > n) {
            return;
        }
        count++;
        yield x;        
    }
}

function* skip<T>(iter: IterableIterator<T>, n: number): IterableIterator<T> {
    let count = 0;
    for (var x of iter) {        
        if (count >= n) {
            yield x;            
        }                        
        count++;                
    }
}

function first<T>(iter: IterableIterator<T>, predicate?: (x:T)=> boolean ) : T { 
    predicate = predicate || ((x) =>true); 
    for(var x of iter){
        if(predicate(x)){            
            return x;
        }
    }
    return null;
}

export class Chain<T> {

    static sequence<T>(_from: T | (() => T), next: (x: T) => T, completed: (x: T) => boolean): Chain<T> {
        return new Chain(sequence(_from, next, completed));
    }

    static from<T>(ts: T[]): Chain<T> {
        return new Chain(ts[Symbol.iterator]());
    }

    constructor(private iterable: IterableIterator<T>) {

    }

    get values() {
        return this.iterable;
    }

    where(filter: (x: T) => boolean): Chain<T> {
        return new Chain(where(this.iterable, filter));
    }

    select<TR>(f: (x: T) => TR): Chain<TR> {
        return new Chain(select(this.values, f));
    }

    take(n: number): Chain<T> {
        return new Chain(take(this.values, n));
    }

    skip(n: number): Chain<T> {
        return new Chain(skip(this.values, n));
    }

    first(predicate?: (x:T)=> boolean ) : T {
        return first(this.values, predicate);
    }

}