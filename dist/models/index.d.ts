declare const _default: {
    tableName: string;
    name: string;
    schema: {
        connectionId: {
            type: StringConstructor;
            required: boolean;
            hasKey: boolean;
        };
        request: {
            type: StringConstructor;
            required: boolean;
        };
        data: {
            type: StringConstructor;
        };
        ttl: {
            type: NumberConstructor;
            default: () => number;
        };
    };
    options: {
        timestamps: {
            createdAt: string;
            updatedAt: string;
        };
    };
}[];
export default _default;
