/**
* Fucntion to return Corrigo Enterprice API Bearer token using CLIENT_ID & CLIENT_SECRET
*
* @return {string} Bearer token
*/
async function getToken() {
	const response = await fetch('https://oauth-pro-v2.corrigo.com/OAuth/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: 'grant_type=client_credentials&client_id=' + CORRIGO_CLIENT_ID + '&client_secret=' + CORRIGO_CLIENT_SECRET
	});
	const data = await response.json();

	return 'Bearer ' + data.access_token;
}

/**
* Function to return Corrigo Enterprise instance API hostname using API Bearer token
*
* @param {string} token - Corrigo Enterprise API Bearer token
* @return {string} Corrigo Enterprise instance API hostname
*/
async function getHostName(token) {
	const response = await fetch('http://am-apilocator.corrigo.com/api/v1/cmd/GetCompanyWsdkUrlCommand', {
		method: 'POST',
		headers: {
			'Authorization': token,
			'CompanyName': CORRIGO_COMPANY_NAME,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			RequestId: '0242422.3340',
			Command: {
				ApiType: 'REST',
				CompanyName: CORRIGO_COMPANY_NAME,
				Protocol: 'HTTPS',
			}
			})
		});
	const data = await response.json();

	return data.CommandResult.Url;
}

/**
* Function to return array of Corrigo Enterprise Work Orders
*
* @param {string} token - Corrigo Enterprise API Bearer token
* @param {string} hostName - Corrigo Enterprise instance API hostname
* @return {string} Array of Corrigo Enterprise Work Orders
*/
async function getWorkOrders(token, hostName) {
	const response = await fetch(hostName + 'api/v1/query/WorkOrder', {
		method: 'POST',
		headers: {
			'Authorization': token,
			'CompanyName': CORRIGO_COMPANY_NAME,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			QueryExpression: {
				Criteria: {
					Conditions: [
						{
							PropertyName: 'LastActionDateUtc',
							Operator: 'GreaterOrEqual',
							Values: [new Date(Math.floor((Date.now() - 300000) / 300000) * 
300000)]
						},
						{
							PropertyName: 'LastAction.LastAction.TypeId',
							Operator: 'Equal',
							Values: ['PickUp']
						}
					],
					FilterOperator: "And"
				},
				Distinct: true,
				PropertySet: {
				Properties : ['Number', 'Employee.Username']
			},
			Count: 0,
			FirstResultIndex: 0
			}
		})
	});
	const data = await response.json();

	var workOrders = [];
	for (var i = 0; i < data.Entities.length; i++)
		workOrders.push(data.Entities[i].Data.Number + ' ' + data.Entities[i].Data.Employee.Username);

	return workOrders;
}

/**
* Function to create Expensify Reports using a Work Order number & email
*
* @param {string} number - Work Order Number
* @param {string} email - Work Order Email
* @return {promise} JSON response
*/
async function createReport(number, email) {
	var response = await fetch('https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: `requestJobDescription=${JSON.stringify({
			type: "create",
			credentials: {
				partnerUserID: EXPENSIFY_USER_ID,
				partnerUserSecret: EXPENSIFY_USER_SECRET
			},
			inputSettings: {
				type: 'report',
				policyID: EXPENSIFY_POLICY_ID,
				report: {
					title: 'Work Order #' + number,
					fields: {
						WorkOrder: number
					}
				},
				employeeEmail: email,
				expenses: []
			}
		})}`
	});
	return await response.json();
}

addEventListener('scheduled', event => {
	event.waitUntil(triggerEvent(event.scheduledTime));
});

async function triggerEvent(scheduledDate) {
	const token = await getToken();
	const hostName = await getHostName(token);
	const workOrders = await getWorkOrders(token, hostName);
	for (var i = 0; i < workOrders.length; i++)
		console.log(await createReport(workOrders[i].split(' ')[0], workOrders[i].split(' ')[1]));
}
