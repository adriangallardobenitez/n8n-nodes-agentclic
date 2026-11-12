# n8n-nodes-agentclic

This is an n8n community node. It lets you use [Agentclic](https://agentclic.com) in your n8n workflows.

Agentclic is a no-code platform for marketing agencies and freelancers to build, sell and manage AI agents for their clients, with a CRM for each client. This node works with the clients and CRM contacts of your Agentclic account through the [Agentclic API](https://agentclic.com/developers).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

*Versión en español más abajo.*

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Compatibility](#compatibility) · [Usage](#usage) · [Resources](#resources) · [Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-agentclic`.

## Operations

| Resource | Operation | What it does |
|---|---|---|
| Account | Get | Gets the API token details and the credit balance of the account. |
| Client | Get Many | Gets the clients of your account. |
| Contact | Create | Creates a contact in the CRM of a client. |
| Contact | Create or Update | Creates a contact. If a contact with the same email or phone already exists in that CRM, it updates that one instead. |
| Contact | Get | Gets a contact with its custom fields. |
| Contact | Get Many | Gets contacts from the CRM of a client, with search and filters by stage, origin and creation date. |
| Contact | Update | Updates the data, stage or custom fields of a contact. Only the fields you add are changed. An empty value clears that field. |

The client, stage and custom field lists load from your account, so you don't need to copy IDs. The node can also be used as a tool by the n8n AI Agent.

## Credentials

You need an Agentclic account on the **Unlimited agents** plan.

1. In Agentclic, go to **Ajustes › API** (Settings › API) and click **Crear token**.
2. Choose the permissions: **Contactos · leer** (read), or **Contactos · leer y escribir** (read and write) to create and update contacts.
3. Optionally, limit the token to a single client. Do this if the token will live in a client's n8n.
4. Copy the token (`ack_live_…`). It is only shown once.
5. In n8n, create an **Agentclic API** credential and paste the token. Leave **Base URL** as it is.

Each successful API call uses credits from your Agentclic account. Calls that end in an error are not charged. The cost per call is shown in Agentclic under **Ajustes › Créditos e IA**. Each token can make up to 60 calls per minute. If that limit is reached, the node waits and retries once.

## Compatibility

Built with the n8n node API version 1 and tested with `n8n-workflow` 2.47.

## Usage

**Send leads from any source to a client's CRM.** Connect your source (a form, a Meta lead, a sheet…) to the Agentclic node with **Contact › Create or Update**. Then choose the client and map the name, email and phone. Add a stage or custom fields under **Additional Fields**. Running it twice with the same lead updates the contact instead of creating a duplicate.

**React to events in Agentclic.** This version has no trigger. To start an n8n workflow from Agentclic, add a **Webhook request** step to an Agentclic flow, pointing to an n8n Webhook node.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Agentclic API documentation](https://agentclic.com/developers)
* [Agentclic help center](https://agentclic.com/docs)

## Version history

See [CHANGELOG.md](CHANGELOG.md).

---

## En español

Nodo de comunidad de n8n para usar **Agentclic** en tus flujos de n8n. Trabaja con los clientes y los contactos del CRM de tu cuenta a través de la [API de Agentclic](https://agentclic.com/developers).

### Instalación

En n8n, ve a **Settings › Community nodes**, pulsa **Install** y escribe `n8n-nodes-agentclic`.

### Qué puedes hacer

- **Cuenta › Get:** ver el token y el saldo de créditos.
- **Cliente › Get Many:** ver tus clientes.
- **Contacto › Create:** crear un contacto en el CRM de un cliente.
- **Contacto › Create or Update:** crea el contacto o, si ya hay uno con el mismo email o teléfono en ese CRM, lo actualiza. Así un mismo lead no se duplica.
- **Contacto › Get / Get Many:** ver un contacto o listar contactos con búsqueda y filtros (etapa, origen, fecha de alta).
- **Contacto › Update:** cambiar los datos, la etapa o los campos personalizados. Solo se cambian los campos que añadas, y un valor vacío borra ese dato.

Los clientes, las etapas y los campos personalizados salen en desplegables desde tu cuenta.

### Credencial

1. En Agentclic, entra en **Ajustes › API** y pulsa **Crear token**. Necesitas el plan **Agentes ilimitados**.
2. Elige los permisos. Para crear y actualizar, elige **Contactos · leer y escribir**.
3. Si el token va a estar en el n8n de un cliente, limítalo a ese cliente.
4. Copia el token (solo se muestra una vez). En n8n, crea una credencial **Agentclic API** y pégalo.

Cada llamada correcta consume créditos de tu cuenta de Agentclic. Las que terminan en error no se cobran. El coste está en **Ajustes › Créditos e IA**.

### Disparadores

Esta versión no tiene disparador. Para lanzar un flujo de n8n desde Agentclic, usa en un flujo de Agentclic el paso **Petición Webhook** apuntando a un nodo Webhook de n8n.
