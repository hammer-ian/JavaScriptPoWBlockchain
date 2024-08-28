const Blockchain = require('./blockchain');

//create new instance of Blockchain
const blockchain = new Blockchain();

const bc1 = {
    "pendingTransactions": [
        {
            "txnID": "40b40fb7dc234079b4d5ee393a676eb8",
            "amount": 12.5,
            "sender": "00",
            "recipient": "40776c7dee59484da0c2031ec4848a62"
        }
    ],
    "chain": [
        {
            "index": 1,
            "timestamp": 1722223622173,
            "transactions": [],
            "nonce": 100,
            "hash": "genesisHash",
            "prevBlockHash": "NA"
        },
        {
            "index": 2,
            "timestamp": 1722223632918,
            "transactions": [],
            "nonce": 33042,
            "hash": "000012f51dfbcbc0355a53c48d9ca99873a7cd9666ec4f48ac082cd5cd9490c0",
            "prevBlockHash": "genesisHash"
        },
        {
            "index": 3,
            "timestamp": 1722223634910,
            "transactions": [
                {
                    "txnID": "9659dc56c0cf443780f228fee084a6fa",
                    "amount": 12.5,
                    "sender": "00",
                    "recipient": "40776c7dee59484da0c2031ec4848a62"
                }
            ],
            "nonce": 24962,
            "hash": "0000e3df3ef7f98f640d1a905204b08e164f36650dc18ad7f7fbe21d7097ad67",
            "prevBlockHash": "000012f51dfbcbc0355a53c48d9ca99873a7cd9666ec4f48ac082cd5cd9490c0"
        },
        {
            "index": 4,
            "timestamp": 1722223636349,
            "transactions": [
                {
                    "txnID": "18bcaa614927446a8ef73105a8482937",
                    "amount": 12.5,
                    "sender": "00",
                    "recipient": "40776c7dee59484da0c2031ec4848a62"
                }
            ],
            "nonce": 56516,
            "hash": "0000e6aaeec2a0bfe019b49ef703eeea6183568a75f844a09d863c918dce5e63",
            "prevBlockHash": "0000e3df3ef7f98f640d1a905204b08e164f36650dc18ad7f7fbe21d7097ad67"
        },
        {
            "index": 5,
            "timestamp": 1722223711169,
            "transactions": [
                {
                    "txnID": "c6c8c052c6474d218d8f8f676598f221",
                    "amount": 12.5,
                    "sender": "00",
                    "recipient": "40776c7dee59484da0c2031ec4848a62"
                },
                {
                    "txnID": "d68bfaaef13d44c8957d30f3564da80a",
                    "amount": 1400,
                    "sender": "hammer",
                    "recipient": "tali"
                },
                {
                    "txnID": "7be6d305c00140e29934508cb3b40fbf",
                    "amount": 100,
                    "sender": "hammer",
                    "recipient": "wifey"
                }
            ],
            "nonce": 48934,
            "hash": "0000fd245c428263eea88938a0e2fd996d4c412ad9e6a97924a4735b15e86bc9",
            "prevBlockHash": "0000e6aaeec2a0bfe019b49ef703eeea6183568a75f844a09d863c918dce5e63"
        },
        {
            "index": 6,
            "timestamp": 1722223744124,
            "transactions": [
                {
                    "txnID": "ed140460d2564cf8af69979ab771176c",
                    "amount": 12.5,
                    "sender": "00",
                    "recipient": "40776c7dee59484da0c2031ec4848a62"
                },
                {
                    "txnID": "b9acb93698ad420688b1b9b2590573d2",
                    "amount": 10,
                    "sender": "hammer",
                    "recipient": "keira"
                },
                {
                    "txnID": "c6e6b7ff810140e692c441718c8ea261",
                    "amount": 150,
                    "sender": "hammer",
                    "recipient": "rocky"
                }
            ],
            "nonce": 75997,
            "hash": "0000db336425e5b4570c3d7b98f472c4cff9750e607b2cda7017d121bc52d3fd",
            "prevBlockHash": "0000fd245c428263eea88938a0e2fd996d4c412ad9e6a97924a4735b15e86bc9"
        },
        {
            "index": 7,
            "timestamp": 1722223757747,
            "transactions": [
                {
                    "txnID": "38b1353c6fa246c9b4bb79e15fe4009a",
                    "amount": 12.5,
                    "sender": "00",
                    "recipient": "40776c7dee59484da0c2031ec4848a62"
                }
            ],
            "nonce": 22608,
            "hash": "0000234201861793f062512662a7adf0fd4db4bd3665f6e910b6017892ce733d",
            "prevBlockHash": "0000db336425e5b4570c3d7b98f472c4cff9750e607b2cda7017d121bc52d3fd"
        },
        {
            "index": 8,
            "timestamp": 1722223760342,
            "transactions": [
                {
                    "txnID": "564579255b774084aba7d4eb60cffaaa",
                    "amount": 12.5,
                    "sender": "00",
                    "recipient": "40776c7dee59484da0c2031ec4848a62"
                }
            ],
            "nonce": 53491,
            "hash": "00008919c7abb856aa6a7daef09209920f110554193f62ed3c4dae3af17a6041",
            "prevBlockHash": "0000234201861793f062512662a7adf0fd4db4bd3665f6e910b6017892ce733d"
        }
    ],
    "currentNodeUrl": "http://localhost:3001",
    "networkNodes": []
}

console.log("VALID: ", blockchain.chainIsValid(bc1.chain));


