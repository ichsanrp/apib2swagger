var escapeJSONPointer = require('./escape_json_pointer');

function convertMsonToJsonSchema(content) {
    // for apib._version = "4.0"
    var mson = content.content[0];
    var schema = convert(mson);
    if (schema.type === 'array') {
        var fixedType = false;
        if (mson.attributes && mson.attributes.typeAttributes) {
            fixedType = mson.attributes.typeAttributes.some(function (typeAttr) {
                return typeAttr === 'fixedType';
            });
        }
        if (!fixedType) {
            return { type: 'array', items: {} }; // reset items schema
        }
    }
    return schema;
}

function convert(mson) {
    // mson.element = "boolean", "string", "number", "array", "enum", "object", CustomType
    switch (mson.element) {
        case 'array':
            if (!mson.content || mson.content.length === 0) {
                return { type: 'array', items: {} };
            } else if (mson.content.length === 1) {
                return { type: 'array', items: convert(mson.content[0]) };
            } else if (mson.content.length > 1) {
                return { type: 'array', items: { 'anyOf': mson.content.map(convert) } };
            }
        case 'enum':
            return convertEnum(mson.content);
        case 'object':
            break;
        case 'integer':
            return { type: mson.element, format:"int32" };
        case 'float':
            return { type: "number", format:"float" };
        case 'double':
            return { type: "number", format:"double" };
        case 'long':
            return { type: "integer", format:"int64" };
        case 'int64':
            return { type: "integer", format:"int64" };
        case 'int32':
            return { type: "integer", format:"int32" };
        case 'uint64':
            return { type: "integer", format:"uint64" };
        case 'uint32':
            return { type: "integer", format:"uint32" };
        case 'date':
            return { type: "string", format:"date" };
        case 'date-time':
            return { type: "string", format:"date-time" };
        case 'byte':
            return { type: "string", format:"byte" };
        case 'number':
            return { type: mson.element };
        case 'boolean':
            return { type: mson.element };
        case 'string':
            return { type: mson.element };
        default:
            if (!mson.content) {
                return { '$ref': '#/definitions/' + escapeJSONPointer(mson.element) };
            }
            break;
    }
    // object
    var schema = {};
    schema.type = 'object';
    schema.required = [];
    schema.properties = {};
    for (var j = 0; mson.content && j < mson.content.length; j++) {
        var member = mson.content[j];
        if (member.element !== "member") continue;
        schema.properties[member.content.key.content] = convert(member.content.value);
        if (member.meta && member.meta.description) {
            schema.properties[member.content.key.content].description = member.meta.description;
        }
        var fixedType = false;
        if (member.attributes && member.attributes.typeAttributes) {
            member.attributes.typeAttributes.forEach(function (typeAttr) {
                switch (typeAttr) {
                    case 'fixedType':
                        fixedType = true;
                        break;
                    case 'required':
                        schema.required.push(member.content.key.content);
                        break;
                }
            });
        }
        if (schema.properties[member.content.key.content].type === 'array' && !fixedType) {
            schema.properties[member.content.key.content].items = {}; // reset item schema
        }
    }

    // According to schema definition, required is a stringArray, which must be non-empty
    if (schema.required.length === 0) {
        delete schema.required
    }

    if (mson.element !== 'object') {
        return { 'allOf': [{ '$ref': '#/definitions/' + escapeJSONPointer(mson.element) }, schema] };
    }

    return schema;
}

function convertEnum(contents) {
    var schema = { type: '', enum: [] };
    for (var i = 0; i < contents.length; i++) {
        var content = contents[i];
        if (!schema.type) {
            schema.type = content.element;
        } else if (schema.type != content.element) {
            // WARN!! mixed type enum
        }
        schema.enum.push(content.content);
    }
    return schema;
}

module.exports = convertMsonToJsonSchema;