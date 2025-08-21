#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CSVGenerator {
  constructor() {
    this.firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra'];
    
    this.lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
    
    this.departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Customer Service', 'IT', 'Research', 'Legal'];
    
    this.cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'Seattle', 'Denver', 'Boston', 'Nashville', 'Baltimore'];
    
    this.products = ['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Webcam', 'Tablet', 'Smartphone', 'Printer'];
    
    this.emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.com'];
  }

  // Utility functions
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomFloat(min, max, decimals = 2) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  }

  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  randomDate(start, end) {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = startTime + Math.random() * (endTime - startTime);
    return new Date(randomTime);
  }

  normalRandom(mean = 0, stdDev = 1) {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  // Data generators
  generateEmployeeData(count) {
    const data = [];
    const headers = ['employee_id', 'first_name', 'last_name', 'email', 'department', 'hire_date', 'salary', 'age', 'performance_score', 'city', 'years_experience'];
    
    data.push(headers);

    for (let i = 1; i <= count; i++) {
      const firstName = this.randomChoice(this.firstNames);
      const lastName = this.randomChoice(this.lastNames);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${this.randomChoice(this.emailDomains)}`;
      const department = this.randomChoice(this.departments);
      const hireDate = this.randomDate(new Date('2015-01-01'), new Date('2023-12-31')).toISOString().split('T')[0];
      const age = this.randomInt(22, 65);
      const yearsExp = Math.min(age - 22, this.randomInt(0, 25));
      const baseSalary = department === 'Engineering' ? 85000 : department === 'Sales' ? 65000 : 55000;
      const salary = Math.round(baseSalary + this.normalRandom(0, 15000) + yearsExp * 2000);
      const performanceScore = Math.max(1, Math.min(5, Math.round(this.normalRandom(3.2, 0.8))));
      const city = this.randomChoice(this.cities);

      data.push([
        `EMP${String(i).padStart(4, '0')}`,
        firstName,
        lastName,
        email,
        department,
        hireDate,
        salary,
        age,
        performanceScore,
        city,
        yearsExp
      ]);
    }

    return data;
  }

  generateSalesData(count) {
    const data = [];
    const headers = ['transaction_id', 'customer_name', 'product', 'quantity', 'unit_price', 'total_amount', 'sale_date', 'salesperson', 'region', 'customer_age', 'discount_percent'];
    
    data.push(headers);

    for (let i = 1; i <= count; i++) {
      const customerName = `${this.randomChoice(this.firstNames)} ${this.randomChoice(this.lastNames)}`;
      const product = this.randomChoice(this.products);
      const quantity = this.randomInt(1, 10);
      const basePrice = product === 'Laptop' ? 1200 : product === 'Desktop' ? 800 : product === 'Monitor' ? 300 : this.randomInt(20, 500);
      const unitPrice = this.randomFloat(basePrice * 0.8, basePrice * 1.3);
      const discountPercent = Math.random() < 0.3 ? this.randomInt(5, 25) : 0;
      const totalAmount = quantity * unitPrice * (1 - discountPercent / 100);
      const saleDate = this.randomDate(new Date('2023-01-01'), new Date('2024-12-31')).toISOString().split('T')[0];
      const salesperson = `${this.randomChoice(this.firstNames)} ${this.randomChoice(this.lastNames)}`;
      const region = this.randomChoice(['North', 'South', 'East', 'West', 'Central']);
      const customerAge = this.randomInt(18, 70);

      data.push([
        `TXN${String(i).padStart(6, '0')}`,
        customerName,
        product,
        quantity,
        unitPrice.toFixed(2),
        totalAmount.toFixed(2),
        saleDate,
        salesperson,
        region,
        customerAge,
        discountPercent
      ]);
    }

    return data;
  }

  generateFinancialData(count) {
    const data = [];
    const headers = ['date', 'revenue', 'expenses', 'profit', 'customers', 'conversion_rate', 'marketing_spend', 'month', 'quarter', 'year'];
    
    data.push(headers);

    let baseRevenue = 100000;
    for (let i = 0; i < count; i++) {
      const date = new Date('2020-01-01');
      date.setDate(date.getDate() + i * 7); // Weekly data
      
      // Add seasonality and trend
      const trend = i * 500;
      const seasonality = Math.sin((i / 52) * 2 * Math.PI) * 10000;
      const noise = this.normalRandom(0, 5000);
      
      const revenue = Math.max(0, baseRevenue + trend + seasonality + noise);
      const expenses = revenue * this.randomFloat(0.6, 0.8);
      const profit = revenue - expenses;
      const customers = Math.round(revenue / this.randomFloat(150, 300));
      const conversionRate = this.randomFloat(0.02, 0.08);
      const marketingSpend = revenue * this.randomFloat(0.1, 0.2);
      
      data.push([
        date.toISOString().split('T')[0],
        revenue.toFixed(2),
        expenses.toFixed(2),
        profit.toFixed(2),
        customers,
        (conversionRate * 100).toFixed(2),
        marketingSpend.toFixed(2),
        date.getMonth() + 1,
        Math.ceil((date.getMonth() + 1) / 3),
        date.getFullYear()
      ]);
    }

    return data;
  }

  generateCustomerData(count) {
    const data = [];
    const headers = ['customer_id', 'name', 'email', 'age', 'city', 'registration_date', 'total_purchases', 'avg_order_value', 'loyalty_score', 'preferred_category', 'last_purchase_date'];
    
    data.push(headers);

    for (let i = 1; i <= count; i++) {
      const name = `${this.randomChoice(this.firstNames)} ${this.randomChoice(this.lastNames)}`;
      const email = `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1].toLowerCase()}@${this.randomChoice(this.emailDomains)}`;
      const age = Math.round(this.normalRandom(40, 15));
      const city = this.randomChoice(this.cities);
      const regDate = this.randomDate(new Date('2020-01-01'), new Date('2023-12-31')).toISOString().split('T')[0];
      const totalPurchases = this.randomInt(1, 50);
      const avgOrderValue = this.randomFloat(25, 500);
      const loyaltyScore = Math.min(100, Math.max(0, Math.round(this.normalRandom(65, 20))));
      const preferredCategory = this.randomChoice(['Electronics', 'Clothing', 'Home', 'Books', 'Sports']);
      const lastPurchaseDate = this.randomDate(new Date('2023-01-01'), new Date('2024-12-31')).toISOString().split('T')[0];

      data.push([
        `CUST${String(i).padStart(5, '0')}`,
        name,
        email,
        age,
        city,
        regDate,
        totalPurchases,
        avgOrderValue.toFixed(2),
        loyaltyScore,
        preferredCategory,
        lastPurchaseDate
      ]);
    }

    return data;
  }

  // Convert array to CSV string
  arrayToCSV(data) {
    return data.map(row => 
      row.map(cell => {
        // Handle cells that contain commas or quotes
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\n');
  }

  // Generate and save CSV file
  generateCSV(type, count, filename) {
    let data;
    
    switch (type.toLowerCase()) {
      case 'employees':
        data = this.generateEmployeeData(count);
        break;
      case 'sales':
        data = this.generateSalesData(count);
        break;
      case 'financial':
        data = this.generateFinancialData(count);
        break;
      case 'customers':
        data = this.generateCustomerData(count);
        break;
      default:
        throw new Error('Invalid data type. Use: employees, sales, financial, or customers');
    }

    const csv = this.arrayToCSV(data);
    const filepath = filename || `${type}_data_${count}_records.csv`;
    
    fs.writeFileSync(filepath, csv, 'utf8');
    
    console.log(`✅ Generated ${filepath} with ${count} records`);
    console.log(`📊 Columns: ${data[0].join(', ')}`);
    console.log(`💾 File size: ${(csv.length / 1024).toFixed(2)} KB`);
    
    return filepath;
  }
}

// Command line interface
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
📊 CSV Data Generator for Data Analysis

Usage: node csv_generator.js <type> <count> [filename]

Data Types:
  employees  - Employee records with salary, performance, demographics
  sales      - Sales transactions with products, customers, regions  
  financial  - Financial time series with revenue, expenses, metrics
  customers  - Customer profiles with purchase history, loyalty scores

Examples:
  node csv_generator.js employees 1000
  node csv_generator.js sales 5000 my_sales_data.csv
  node csv_generator.js financial 200 quarterly_data.csv
  node csv_generator.js customers 2000
    `);
    return;
  }

  const [type, countStr, filename] = args;
  const count = parseInt(countStr);

  if (isNaN(count) || count <= 0) {
    console.error('❌ Error: Count must be a positive number');
    return;
  }

  const generator = new CSVGenerator();
  
  try {
    const filepath = generator.generateCSV(type, count, filename);
    console.log(`\n🎉 Ready for analysis! Import ${filepath} into your favorite data analysis tool.`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = CSVGenerator;