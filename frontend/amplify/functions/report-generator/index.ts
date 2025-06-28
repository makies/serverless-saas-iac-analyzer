export const handler = async (event: any) => {
  console.log('Report generator called with:', JSON.stringify(event, null, 2));
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Report generator function executed successfully',
      event
    })
  };
};