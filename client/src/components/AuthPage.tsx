import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Code2, Sparkles, Zap } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { User, RegisterUserInput, LoginUserInput } from '../../../server/src/schema';

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [loginForm, setLoginForm] = useState<LoginUserInput>({
    email: '',
    password: ''
  });

  const [registerForm, setRegisterForm] = useState<RegisterUserInput>({
    email: '',
    password: '',
    name: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.loginUser.mutate(loginForm);
      onLogin(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.registerUser.mutate(registerForm);
      onLogin(response.user);
    } catch (error) {
      console.error('Registration failed:', error);
      setError('Registration failed. Email might already be in use.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black">
      <div className="w-full max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Hero Section */}
          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start space-x-3 mb-6">
                <Code2 className="w-12 h-12 text-blue-400" />
                <span className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  AI Builder
                </span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Build Apps with
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  AI Power
                </span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Create, manage, and deploy your applications with intelligent code generation. 
                Your private workspace for building the future.
              </p>
            </div>

            <div className="grid gap-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">AI-Powered Generation</h3>
                  <p className="text-gray-400">Generate components, features, and entire applications with intelligent AI assistance.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Visual Code Editor</h3>
                  <p className="text-gray-400">Edit your project files directly in the browser with syntax highlighting and IntelliSense.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">One-Click Deploy</h3>
                  <p className="text-gray-400">Deploy your applications instantly to the cloud with automated CI/CD pipelines.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Form */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-2xl text-center text-white">Get Started</CardTitle>
                <CardDescription className="text-center text-gray-400">
                  Sign in to your account or create a new one
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {error && (
                  <Alert className="mb-6 bg-red-950 border-red-800">
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="login" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-700">
                    <TabsTrigger value="login" className="data-[state=active]:bg-gray-600">Sign In</TabsTrigger>
                    <TabsTrigger value="register" className="data-[state=active]:bg-gray-600">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login" className="space-y-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="login-email" className="text-gray-300">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginForm.email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLoginForm((prev: LoginUserInput) => ({ ...prev, email: e.target.value }))
                          }
                          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          placeholder="Enter your email"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="login-password" className="text-gray-300">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          value={loginForm.password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLoginForm((prev: LoginUserInput) => ({ ...prev, password: e.target.value }))
                          }
                          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          placeholder="Enter your password"
                          required
                        />
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700" 
                        disabled={isLoading}
                      >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="register" className="space-y-4">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <Label htmlFor="register-name" className="text-gray-300">Full Name</Label>
                        <Input
                          id="register-name"
                          type="text"
                          value={registerForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRegisterForm((prev: RegisterUserInput) => ({ ...prev, name: e.target.value }))
                          }
                          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          placeholder="Enter your full name"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="register-email" className="text-gray-300">Email</Label>
                        <Input
                          id="register-email"
                          type="email"
                          value={registerForm.email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRegisterForm((prev: RegisterUserInput) => ({ ...prev, email: e.target.value }))
                          }
                          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          placeholder="Enter your email"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="register-password" className="text-gray-300">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          value={registerForm.password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRegisterForm((prev: RegisterUserInput) => ({ ...prev, password: e.target.value }))
                          }
                          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          placeholder="Minimum 8 characters"
                          minLength={8}
                          required
                        />
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-purple-600 hover:bg-purple-700" 
                        disabled={isLoading}
                      >
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}