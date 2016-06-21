import * as fs from 'fs';
import {assert} from 'chai';
import * as path from 'path';
import * as dirtyx from '../Dirtyx';
//import * as Rx from 'rx';

import Dirtyx = dirtyx.Dirtyx;

interface User { name: string ;  eyes: string }

describe('Dirtyx', () => {

    it('?', async () => {

        let dbPath = path.join(process.cwd(), '/bob.dirty');

        var db = await Dirtyx.createNew<string,User>(dbPath, x => x.name);
                 
        await db.setAsync({ name: 'john', eyes: 'blue' });
        assert.equal(db.get('john').eyes, 'blue');
        
        await db.setAsync({ name: 'john', eyes: 'red' });
        assert.equal(db.get('john').eyes, 'red');

        await db.setAsync({ name:'bob', eyes: 'brown' });
        assert.equal(db.get('bob').eyes, 'brown');

        await db.setAsync({ name:'bob', eyes: 'green' });
        assert.equal(db.get('bob').eyes, 'green');
        
        let keys = [];
        db.forEach((key, val) => {
            keys.push(key);
            console.log('Found key: %s, val: %j', key, val);
        });
        
        assert.equal(keys.length, 2);
        assert.deepEqual(['john', 'bob'], keys);

        await db.remove('john');
        let notFound = db.get('john');
        assert.isUndefined(notFound);

        //Key Length == size()
        assert.equal(db.size(), 1);

        assert.equal(db.first(x=> x.name == 'bob').name , 'bob');

        let found = db.query.where(x=> x.eyes == "green").first();
        assert.equal(found.name ,  'bob');
        console.log(found);
        
})
})



