import {Chain} from './chain';
import {Dirty} from './Dirty';

export class Dirtyx<TKey, TValue> extends Dirty {

    /**
    * factory
    */
    static createNew<K, V>(path: string, key: (value: V) => K): Promise<Dirtyx<K, V>> {

        return new Promise((resolve, reject) => {

            try {
                let d = new Dirtyx<K, V>(path, key);

                d.once('error', ex => reject(ex));

                d.on('load', () => resolve(d))

            } catch (e) {
                reject(e);
            }
        });
    }


    constructor(dbPath: string, private getKey: (value: TValue) => TKey) {
        super(dbPath);
    }

    setAsync(value: TValue): Promise<this> {

        let key = this.getKey(value);

        let self = this;

        return new Promise((resolve, reject) => {
            try {
                this.once('drain', () =>
                    resolve(self)
                )
                this.once('error',
                    e => reject(e)
                );
                this.set(key, value);
            } catch (e) {
                reject(e)
            }
        })
    }
    private isKey(x: any) {
        return 'string' == typeof x || 'number' == typeof x || 'Date' == typeof x;
        // byte? 
    }
    /**
     * Reove by key or by entity
     */
    remove(xKey: TValue | TKey): Promise<this> {

        let key = this.isKey(xKey) ? xKey : this.getKey(xKey as TValue);

        return new Promise((resolve, reject) => {
            try {
                // this is not Ok , unsubcribing ?
                this.once('error', e => reject(e));
                this.rm(key, () => {
                    resolve(this);
                })
            } catch (e) {
                reject(e);
            }
        });
    }

    first(predicate: (x: TValue) => boolean): TValue {
        
        for (let key of this._keys) {

            let value = this._docs[key];

            if (predicate(value) === true) {
                return value;
            }
        }
        return null;
    }

    *values() {    
        for (let key of this._keys) {
            yield this._docs[key];            
        }        
    }

    get query() :Chain<TValue> {
        return new Chain(this.values());
    }
    
    [Symbol.iterator]() { return  this.values() ; }

}