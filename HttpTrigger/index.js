module.exports = async function (context, req) {
    context.log("JavaScript HTTP trigger function processed a request.");

    var parametersKeys = Object.keys(req.query);
    var parameters = req.query;

    if (!parametersKeys.length && req.body) {
        parametersKeys = Object.keys(req.body);
        parameters = req.body;
    }

    if (parametersKeys.length) {
        var uuid = require('uuid/v4');
        var storage = require("azure-storage");
        var config = require("./config");

        if (config.useDevelopmentStorage) {
            //Creates a connection string that can be used to create a service which runs on the storage emulator. The emulator must be downloaded separately.
          config.connectionString = storage.generateDevelopmentStorageCredentials();
        }

        //var entityGenerator = storage.TableUtilities.entityGenerator;
        var createTableService = storage.createTableService(config.connectionString);
        var tableName = "people";
        var person = {};

        for (var i = 0; i < parametersKeys.length; i++) {
            person[parametersKeys[i]] = parameters[parametersKeys[i]];
        }

        try {
            await createTable(createTableService, tableName);

            var entityGenerator = storage.TableUtilities.entityGenerator;
            var personEntity = {
                /* It will be an identifier used to identify a partition on which entity is stored.
                This is used for scaling */
                PartitionKey: entityGenerator.String(person.partitionKey || "Non-Partition"),

                /* This is unique key within a partition. The most efficient query 
                is composite Partition Key + Row Key */
                RowKey: entityGenerator.String(person.rowKey || uuid()),
                name: entityGenerator.String(person.name)
            };

            var insertEntityResult = await insertEntity(createTableService, tableName, personEntity);

            var tableQuery = new storage.TableQuery().top(10);
            var queryEntities = await getTopTenEntities(createTableService, tableName, tableQuery, null);

            var responseMsg = insertEntityResult.message + "\n";
            responseMsg += "Top 10 records\n";
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
            body: "Please pass required parameters in the query string or in the request body"
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

function insertEntity(createTableService, tableName, entity) {
    return new Promise((resolve, reject) => {
        createTableService.insertOrMergeEntity(tableName, entity, (error, result, insertResult) => {
            if (error) {
                return reject(error);
            }

            if (insertResult.isSuccessful) {
                return resolve({
                    success: true,
                    message: "Person added/updated successfully"
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