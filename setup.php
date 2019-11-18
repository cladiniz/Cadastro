<?php

include_once 'db.inc.php';

session_start();

class Setup{

	//  Vai sempre retornar JSON
	var $ret = ['error' => FALSE];

	public function __construct(){

		if ($_SERVER['REQUEST_METHOD'] === 'POST'){
		
			$this -> db = new DB;		

			//  Só continua se existir no_config error no DB
			if ($this -> db -> error && $this -> db -> error_data[0] == 'no_config'){
				$this -> config_save();			
			}else{
				$this -> ret = ['error' => 'Configuração já foi realizada'];
			}

			echo json_encode($this -> ret);

		}

	}

	//  Testa dados POST, confere a conexão e aonde o config pode ser salvo
	private function config_save(){

		$post = $this -> post_check();
		
		if ($post){

			//  Tenta realizar novamente a conexão com os dados informados
			$this -> db = new DB($post);

			if (!$this -> db -> error){

				//  Database check
				if ($this -> database_check()){

					//  Table check
					if ($this -> table_check()){

						//  Tudo certo com a database, salva no arquivo ou na session
						$this -> ret['msg_01'] = 'Setup inicial realizado com sucesso';
						
						if (is_writable('config.inc.php')){

							$t = '<?php $config_db = ';
							$t .= var_export($this -> db -> config, TRUE);
							$t .= '; ?>';
							
							$f = fopen('config.inc.php', 'w');
							fwrite($f, $t);
							fclose($f);

						}else{

							$msg_02 = 'ATENÇÃO: O arquivo config.inc.php não tem permissão de escrita. ';
							$msg_02 .= 'Os dados de configuração foram salvos na sessão e serão perdidos ';
							$msg_02 .= 'ao fim da mesma.';							
							$this -> ret['msg_02'] = $msg_02;
							$_SESSION['config_db'] = $this -> db -> config;
							
						}

					}else{
						$this -> ret = ['error' => $this -> db -> error_data];
					}
					
				}else{
					$this -> ret = ['error' => $this -> db -> error_data];
				}

			}else{
				$this -> ret = ['error' => $this -> db -> error_data];
			}
			
		}else{
			$this -> ret = ['error' => 'Os dados enviados não são válidos'];
		}

	}

	//  Confere se a database existe, se não existir tenta criar
	private function database_check(){

		$count = $this -> db -> query(
			'SELECT COUNT(*) AS DB_CHECK FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
			array($this -> db -> config['db'])
		);

		if ($count[0]['DB_CHECK'] == 0){
			
			$this -> db -> query(sprintf('CREATE DATABASE %s', $this -> db -> config['db']));
			return $this -> db -> error ? FALSE : TRUE;
			
		}else{
			return TRUE;
		}
		
	}	

	//  Confere se os dados POST são válidos
	private function post_check(){

		$ret = [];
		$checklist = ['host', 'port', 'db', 'user', 'pass'];

		foreach ($checklist AS $check){

			if (isset($_POST[$check]) && strlen($_POST[$check]) >= 2){
				$ret[$check] = $_POST[$check];
			}
			
		}

		return count($ret) == 5 ? $ret : FALSE;

	}

	//  Confere se a tabela já existe, cria se não
	private function table_check(){

		$count = $this -> db -> query(
			'SELECT count(*) AS TABLE_CHECK  
             FROM information_schema.TABLES 
             WHERE (TABLE_SCHEMA = ?) AND (TABLE_NAME = ?)',
			[$this -> db -> config['db'], 'cl_dados']
		);

		if ($count[0]['TABLE_CHECK'] == 0){

			$this -> db -> query(sprintf('USE %s', $this -> db -> config['db']));
			$this -> db -> query(file_get_contents('cl_dados.sql'));

			return $this -> db -> error ? FALSE : TRUE;
			
		}else{
			return TRUE;
		}

	}

}

new Setup();

?>
