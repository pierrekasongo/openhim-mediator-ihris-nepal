# openhim-mediator-ihris-np

Pass Through Meediator for Nepal Health Horkfoce Registry

# Installation 
    You should have a running openHIM-core

    run npm install

    run npm start 

        or
    run node lib/index.js

# To get all data from the registry

GET /api/v1/getPractitioners

# To get data by fields from the registry

GET /api/v1/getPractitioners/:field/:value

    for example to get data by id
        /api/v1/getPractitioners/id/1
    
    # Field options
        id - passport or citizenship number
        name - Firstname or middle name or surname
        council - registration council name
        cadre - cadre name
        regNo - registration number from the council

See Result Sample JSON in examples/sampleResult.json

# To send Data to the registry

POST /api/v1/updatePractitioner

See Upload JSON format in examples/data-structure.json

Result for update is as below

{
    "status": 200,
    "message": "Data successfully updated!",
    "Providers inserted": 0,
    "Providers updated": 1
}
