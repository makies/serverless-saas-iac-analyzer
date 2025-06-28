export const handler = async (event: any) => {
  console.log('Analysis handler called with:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Analysis function executed successfully',
      event,
    }),
  };
};
