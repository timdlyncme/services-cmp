import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { Fingerprint, Server, AlertCircle, CheckCircle2, X } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isServerConnected, checkServerConnection } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check server connection on component mount
    const checkConnection = async () => {
      await checkServerConnection();
    };
    
    checkConnection();
    
    // Set up interval to check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, [checkServerConnection]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      // Store email in localStorage for mock authentication
      localStorage.setItem("userEmail", email);
      
      await login(email, password);
      navigate("/");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="flex items-center mb-8">
        <img 
          src="/new-logo-transparent.png" 
          alt="Company Logo" 
          className="h-10 w-auto mr-3" 
        />
        <h1 className="text-3xl font-bold">Cloud Management</h1>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
          <div className="flex items-center justify-center mt-2">
            {isServerConnected ? (
              <div className="flex items-center text-green-500 text-sm">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                <span>Server connected</span>
              </div>
            ) : (
              <div className="flex items-center text-red-500 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>Server disconnected</span>
              </div>
            )}
          </div>
        </CardHeader>
        <Tabs defaultValue="email">
          <TabsList className="grid grid-cols-2 mx-6">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="sso">SSO</TabsTrigger>
          </TabsList>
          <TabsContent value="email">
            <CardContent className="space-y-4 pt-4">
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </TabsContent>
          <TabsContent value="sso">
            <CardContent className="pt-4">
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Enterprise SSO login is available for configured tenants.
                </p>
                <Input placeholder="company-domain.com" />
                <Button className="w-full">Continue with SSO</Button>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground mt-4">
            <p>Demo credentials:</p>
            <p>admin@example.com (Admin)</p>
            <p>user@example.com (User)</p>
            <p>msp@example.com (MSP)</p>
            <p className="mt-1">Password: password</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
