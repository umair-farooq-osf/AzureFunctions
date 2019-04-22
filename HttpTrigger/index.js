module.exports = async function (context, req) {
    context.log("JavaScript HTTP trigger function processed a request.");

    var parametersKeys = Object.keys(req.query);
    var parameters = req.query;

    if (!parametersKeys.length && req.body) {
        parametersKeys = Object.keys(req.body);
        parameters = req.body;
    }

    if (parametersKeys.length) {
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
                PartitionKey: entityGenerator.String(person.name),
                RowKey: entityGenerator.String(person.name),
                name: entityGenerator.String(person.name),
            };

            var insertEntityResult = await insertEntity(createTableService, tableName, personEntity);

            context.res = {
                body: insertEntityResult.message
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
                    message: "Person added successfully"
                });
            }

            reject("Something went wrong!!");
        });
    });
}