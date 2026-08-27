const API_URL = 'https://backboard.railway.app/graphql/v2';

function getToken(): string {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) {
    throw new Error('Railway não configurado - falta RAILWAY_API_TOKEN no .env.');
  }
  return token;
}

interface RailwayDeployment {
  id: string;
  status: string;
  createdAt: string;
}

interface RailwayGraphQLResponse {
  data?: {
    projects: {
      edges: Array<{
        node: {
          name: string;
          services: {
            edges: Array<{
              node: {
                name: string;
                deployments: { edges: Array<{ node: RailwayDeployment }> };
              };
            }>;
          };
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export interface DeployStatus {
  project: string;
  service: string;
  status: string;
  createdAt: string;
}

/**
 * Status do último deploy de cada serviço, em todos os projetos que o
 * token do Railway (token de time - ver README, seção "Railway API") pode
 * ver. Descoberto empiricamente: com token de time, a query fica na raiz
 * (`projects`), não sob `me { projects }` como a documentação sugere pra
 * tokens de conta pessoal.
 */
export async function listDeployStatuses(): Promise<DeployStatus[]> {
  const query = `query {
    projects {
      edges {
        node {
          name
          services {
            edges {
              node {
                name
                deployments(first: 1) {
                  edges { node { id status createdAt } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const json = (await resp.json()) as RailwayGraphQLResponse;
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  const result: DeployStatus[] = [];
  for (const p of json.data?.projects.edges ?? []) {
    for (const s of p.node.services.edges) {
      const dep = s.node.deployments.edges[0]?.node;
      if (dep) {
        result.push({ project: p.node.name, service: s.node.name, status: dep.status, createdAt: dep.createdAt });
      }
    }
  }
  return result;
}
