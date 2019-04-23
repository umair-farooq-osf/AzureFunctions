# AzureFunctions
Azure function and Azure Storage examples<br/><br/>
Two azure functions are developed

### HttpTrigger
* Supports both GET and POST.
* Create table if it doesn't exist with id: **people**.
* Insert/update entry in db with **name** passed in query parameter or request body.
* If **partitionKey** is not passed in query parameter or request body, default value **Non-Partition** is used. Otherwise the query parameter or request body value is used.
* If **rowKey** is not passed in query parameter or request body, a random string using **uuid** package is used. Otherwise the query parameter or request body value is used.
* Query top 10 records and sends those in response.

### HttpTriggerBatch
* Supports POST only.
* Create table if it doesn't exist with id: **people**.
* Expects **array** with key **people** in request body
* Insert/update entries in db in batches with **name** passed in each object of people array in request body
* If **partitionKey** is not passed in array object, a a random string is used as partition key for all objects not having a partition key.
* If **rowKey** is not passed in array object, a random string using **uuid** package is used.
* Query top 10 records and sends those in response
