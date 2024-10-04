import { ApolloClient, gql, InMemoryCache } from '@apollo/client/core';

const LOGIN_QUERY = gql`
mutation ObtainKrakenToken($apiKey: String!) {
    obtainKrakenToken(input: { APIKey: $apiKey }) {
        token
        payload
        refreshToken
        refreshExpiresIn
    }
}
`;

const BILLS_QUERY = gql`
query Account($accountNumber: String!, $first: Int, $fromDate: String) {
    account(accountNumber: $accountNumber) {
        id
        number
        status
        bills(first: $first, after: $fromDate) {
            edges {
                cursor
                node {
                    id
                    billType
                    fromDate
                    toDate
                    temporaryUrl
                    issuedDate
                    ... on StatementType {
                        billType
                        totalCharges {
                            grossTotal
                        }
                    }
                }
            }
        }
    }
}
`;

export interface KrakenBill {
    id: string;
    billType: string;
    fromDate: string;
    toDate: string;
    temporaryUrl: string;
    issuedDate: string;
    total: number;
}

const client = new ApolloClient({
    uri: 'https://api.octopus.energy/v1/graphql/',
    cache: new InMemoryCache(),
});

export const getKrakenToken = async (apiKey: string): Promise<string> => {
    const response = await client.mutate({
        mutation: LOGIN_QUERY,
        variables: {
            apiKey,
        },
    });

    const token = response?.data?.obtainKrakenToken?.token;

    if (!token) {
        throw new Error("No token returned");
    }

    return token;
}

export const getBills = async (token: string, accountNumber: string, total: number = 10): Promise<KrakenBill[]> => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    console.log(oneWeekAgo.toISOString());

    const response = await client.query({
        query: BILLS_QUERY,
        context: {
            headers: {
                Authorization: token,
            },
        },
        variables: {
            accountNumber,
            first: total,
            fromDate: oneWeekAgo.toISOString(),
        },
    });

    const nodes = response?.data?.account?.bills?.edges.map((edge: { node: unknown }) => edge.node);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return nodes.map((node: any) => ({
        id: node.id,
        billType: node.billType,
        fromDate: node.fromDate,
        toDate: node.toDate,
        temporaryUrl: node.temporaryUrl,
        issuedDate: node.issuedDate,
        total: node.totalCharges.grossTotal,
    }));
}

export const downloadBill = async (url: string): Promise<Buffer> => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(buffer);

    return pdfBuffer;
}
