# Use an official Node.js image as the base
FROM node:20

# Set the working directory inside the container
WORKDIR /app 

# Copy the package.json file to the container
COPY package.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose the port your app runs on
EXPOSE 3001

# Command to run the app
CMD ["node", "dev/networkNode.js"]

