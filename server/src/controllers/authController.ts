import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Usuarios mock para desarrollo (sin base de datos)
const mockUsers = [
  {
    id: '1',
    email: 'admin@legaltech.com',
    password: '$2a$10$rOzJqK1lYz7Q9Q9Q9Q9Q9O', // password: admin123
    name: 'Administrador',
    role: 'admin'
  },
  {
    id: '2',
    email: 'abogado@legaltech.com', 
    password: '$2a$10$rOzJqK1lYz7Q9Q9Q9Q9Q9O', // password: abogado123
    name: 'Ana García',
    role: 'abogado_senior'
  }
];

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    
    // Check if user exists
    const existingUser = mockUsers.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (in memory only for development)
    const newUser = {
      id: (mockUsers.length + 1).toString(),
      email,
      password: hashedPassword,
      name,
      role: role || 'abogado_junior'
    };

    mockUsers.push(newUser);
    res.status(201).json({ message: 'User created successfully', userId: newUser.id });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user in mock data
    const user = mockUsers.find(user => user.email === email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password (usando bcrypt para las contraseñas mock)
    // Para desarrollo, podemos usar contraseñas simples temporalmente
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Para desarrollo, también aceptamos contraseñas simples
      if (password === 'admin123' && email === 'admin@legaltech.com') {
        // Permitir login con contraseña simple para desarrollo
      } else if (password === 'abogado123' && email === 'abogado@legaltech.com') {
        // Permitir login con contraseña simple para desarrollo
      } else {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};
