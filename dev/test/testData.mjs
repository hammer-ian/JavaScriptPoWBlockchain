//Test data shared across all tests

//We export a deep copy so each test can modify the data as required without impacting other tests

//static addresses as later we test hash functions which need consistent values input
export const minerAddress = 'f6e8e4fa8a4c46cab09d9833737f2665';
export const creditAddress = '670ef2b4eae44f2493e2b255d9e0ba22';
export const debitAddressPreMine = process.env.GENESIS_PRE_MINE_ACC;
export const debitAddress1 = '178a6faf6c6e482a8e73d0b702e8af0c';
export const debitAddress2 = '6ade601c85f24ff891943b802d985c7d';
export const debitAddress3 = '32795eb2a160437e8ee3e634d8850585';

const testTransactions = [
    {
        txnID: 'testTxnID1',
        debitAddress: debitAddressPreMine,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 0
    }, {
        txnID: 'testTxnID2',
        debitAddress: debitAddressPreMine,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 1
    }, {
        txnID: 'testTxnID3',
        debitAddress: debitAddressPreMine,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 2
    }, {
        txnID: 'testTxnID4',
        debitAddress: debitAddress1,
        creditAddress: creditAddress,
        amount: 100,
        gas: 100,
        nonce: 0
    }, {
        txnID: 'testTxnID5',
        debitAddress: debitAddress2,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 0
    }, {
        txnID: 'testTxnID6',
        debitAddress: debitAddress3,
        creditAddress: creditAddress,
        amount: 100,
        gas: 1,
        nonce: 0
    }
]

const testTransactions2 = [
    {
        txnID: 'testTxnID8',
        debitAddress: debitAddressPreMine,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 3
    }, {
        txnID: 'testTxnID9',
        debitAddress: debitAddressPreMine,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 4
    }, {
        txnID: 'testTxnID10',
        debitAddress: debitAddress3,
        creditAddress: creditAddress,
        amount: 100,
        gas: 10,
        nonce: 1
    }
]

export const testBlocks = [
    {
        index: 2,
        timestamp: '1728871651818',
        transactions: testTransactions,
        nonce: 104432,
        hash: '0000blockHash',
        prevBlockHash: 'genesisHash',
        miner: 'minerAddress',
        stateRoot: 'stateRootHash',
        merkleRoot: 'merkleRootHash'
    },
    {
        index: 3,
        timestamp: '1728871651818',
        transactions: testTransactions2,
        nonce: 104432,
        hash: '0000anotherblockHash',
        prevBlockHash: '0000blockHash',
        miner: 'minerAddress',
        stateRoot: 'stateRootHash',
        merkleRoot: 'merkleRootHash'
    },
];


/*
* Hierachy of chain data is 
* array of blocks -> block object -> block properties -> array of txns -> txn object -> txn properties
* map() copies the contents of an array into a new array with the results of the function we pass
* ... spread operator creates a shallow copy i.e. it only goes 1 level down
* we want to return a deep copy of the data with no references to the original arrays so each test can safely modify data
* to do this we need to first shallow copy the block - but the block's transaction property array will still contain references
* then overwrite the block's transaction property with a 2nd shallow copy of the transaction array
*/
export function getTestBlockData() {
    return testBlocks.map(block => ({
        ...block,  // Use spread operator to shallow copy the block object properties and values. Note only goes 1 
        transactions: block.transactions.map(txn => ({
            ...txn //overwritecopy the "transaction" property with
        })
        )
    }));
}

export function getTestTransactionData() {
    return testTransactions.map(txn => ({ ...txn }))
};
