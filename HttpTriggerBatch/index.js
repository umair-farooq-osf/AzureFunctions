module.exports = async function (context, req) {
    context.log("JavaScript HTTP trigger function processed a request.");

    if (req.body) {
        parametersKeys = Object.keys(req.body);
        parameters = req.body;
    }

    if (req.body && req.body.people && Array.isArray(req.body.people)) {
        var uuid = require('uuid/v4');
        var storage = require("azure-storage");

        var createTableService = storage.createTableService(process.env.AzureWebJobsStorage);
        var entityGenerator = storage.TableUtilities.entityGenerator;
        var tableName = "people";
        var partitionKey = uuid();
        var batches = [];

        for (var i = 0; i < req.body.people.length; i++) {
            var person = req.body.people[i];
            var insertBatch;
            var batchIndex = -1;

            if (person.partitionKey) {
                batchIndex = batches.findIndex(batch => batch.partitionKey === person.partitionKey);
            }


            if (batchIndex === -1) {
                insertBatch = new storage.TableBatch();
            }

            if (insertBatch) {
                insertBatch.insertOrMergeEntity(
                    getPersonEntity(
                        entityGenerator,
                        person.partitionKey || partitionKey,
                        person.rowKey || uuid(),
                        person.name
                    )
                );
                batches.push(insertBatch);
            } else {
                batches[batchIndex].insertOrMergeEntity(
                    getPersonEntity(
                        entityGenerator,
                        person.partitionKey || partitionKey,
                        person.rowKey || uuid(),
                        person.name
                    )
                );
            }
        }

        try {
            await createTable(createTableService, tableName);

            for (var i = 0; i < batches.length; i++) {
                await insertEntities(createTableService, tableName, batches[i]);
            }

            var tableQuery = new storage.TableQuery().top(10);
            var queryEntities = await getTopTenEntities(createTableService, tableName, tableQuery, null);

            var responseMsg = "Top 10 records\n";
            responseMsg += queryEntities.people;

            context.res = {
                body: responseMsg
            };
        } catch (error) {
            context.res = {
                body: typeof error === "object" ? error.message : error
            };
        }
    }
    else {
        context.res = {
            status: 400,
            body: "Please pass required parameters in the request body"
        };
    }
};

function createTable(createTableService, tableName) {
    return new Promise((resolve, reject) => {
        createTableService.createTableIfNotExists(tableName, (error, createResult) => {
            if (error) {
                return reject(error);
            }

            if (createResult.isSuccessful) {
                return resolve({
                    success: true,
                    message: !createResult.created
                        ? "Table: " + tableName + " already created"
                        : "Table: " + tableName + " created successfully"
                });
            }

            reject("Something went wrong!!");
        });
    });
}

function insertEntities(createTableService, tableName, batch) {
    return new Promise((resolve, reject) => {
        createTableService.executeBatch(tableName, batch, (error, result, insertResult) => {
            if (error) {
                return reject(error);
            }

            if (insertResult.isSuccessful) {
                return resolve({
                    success: true,
                    message: "Persons added/updated successfully"
                });
            }

            reject("Something went wrong!!");
        });
    });
}

function getTopTenEntities(createTableService, tableName, tableQuery, continuationToken) {
    return new Promise((resolve, reject) => {
        createTableService.queryEntities(tableName, tableQuery, continuationToken, function (error, result) {
            if (error) {
                return reject(error);
            }

            var entities = result.entries;
            var people = [];
            entities.forEach(function (entity) {
                people.push("Partition Key: " + entity.PartitionKey._ 
                    + ", Row Key: " + entity.RowKey._ 
                    + ", Name: " + entity.name._);
            });

            resolve({
                people: people.join("\n")
            });
        });
    })
}

function getPersonEntity(entityGenerator, partitionKey, rowKey, name) {
    return {
        /* It will be an identifier used to identify a partition on which entity is stored.
        This is used for scaling */
        // All entities in batch must have same partition key
        PartitionKey: entityGenerator.String(partitionKey),

        /* This is unique key within a partition. The most efficient query 
        is composite Partition Key + Row Key */
        RowKey: entityGenerator.String(rowKey),
        name: entityGenerator.String(name)
    }
}