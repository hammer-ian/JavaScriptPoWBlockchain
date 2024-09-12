Simplified Blockchain project to deepend my understanding of the inner workings of blockchain
Built using Javascript

---------------------------------------------------------------------------------------
Below is a brief roadmap how I see the project developing:
---------------------------------------------------------------------------------------

**V1 – mimics proof work Bitcoin – COMPLETE**
•	Blockchain supports posting of transactions
•	No concept of ‘account’ e.g. an account balance

**V2  - mimic proof of work Ethereum**
•	Add an account model which maintains state
  Account to support two types of transactions
    ‘Cash’ transaction e.g. a credit/debit between accounts
    ‘NFTs’ – moving a file between accounts
•	Build a lightweight virtual machine that has a runtime environment isolated from the blockchain node that it runs on
•	Allow ‘smart contracts’ to be deployed and executed on the VM to update the ‘state’

**V3 – offer different consensus options**
•	Experiement with adding cryptographic signatures
•	Make the consensus algorithm modular, people can choose

---------------------------------------------------------------------------------------
Below is a detailed activity log of completed work documenting the features in detail:
---------------------------------------------------------------------------------------

**V1**
**Project & AWS infrastructure**
•	Set up github repo
•	Made blockchain data accessible from public internet
•	Implemented htttps
•	Implemented restrictive Security Groups & IAM roles
•	Added swapspace as a workaround for limited t2.micro RAM
•	Private subnet (no IGW) for non-public facing EC2 instances
•	AMI Image of master blockchain node
•	Migrated from basic string based logging to 3rd party logger Winston
•	Onboarded logs/metrics to centralized aggregator
**Blockchain Features**
•	Added multi host capability (initial version only supported multiples nodes on a single host)
•	Restricted public access to endpoints that should only be called internally by a blockchain node
•	Fully automated the start of blockchain node when a new EC2 instance starts
  Automated the registration of new node with the blockchain network when a node starts
  Automated the consensus check when a node starts so new nodes get the latest copy of the blockchain
  Automated de-registration of “unhealthy” nodes from blockchain network 
    ELB/Target Group HC detects issue -> 
    CloudWatch Alarm fired -> 
    Lambda outside VPC invoked -> 
    Lambda inside VPC invoked -> 
    Deregistration request made to healthy node -> 
    Unhealthy nodes identified and deregistered

**V2**
**Project & AWS Infrastructure**
•	TBC
**Blockchain Features**
•	Implemented JSON schema validation for POST requests
•	Implemented Account model to enabled “state” to be maintained on blockchain
  Automate node account creation at start up (for mining rewards)
  Account address and debit validations
